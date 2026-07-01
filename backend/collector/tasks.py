"""
Celery tasks for the Arb collector.

Two tasks run every 15 seconds via Celery Beat:
  1. collect_etf_prices  — fetch prices, persist to DB, cache in Redis
  2. compute_spreads     — read from Redis, compute spread + z-score, persist

Data flow:
  External APIs → collect_etf_prices → PostgreSQL (raw tick)
                                     → Redis hash (latest snapshot)
                                     → Redis stream (event log)
                                     ↓
                  compute_spreads   → Redis list (rolling window)
                                     → PostgreSQL (spread snapshot)
                                     → Redis stream (analytics event for WS)
                                     → log alert if |z_score| > threshold
"""

import logging
from datetime import datetime, timezone, time as dt_time
from decimal import Decimal

import pytz

from collector.celery_app import celery_app
from collector.data_sources import get_mfapi_nav, get_yf_price
from collector.spreads import etf_premium_discount, z_score

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.redis_client import (
    get_redis,
    price_key,
    spread_history_key,
    PRICE_TICK_STREAM,
)
from app.models.assets import Asset
from app.models.price_tick import PriceTick
from app.models.spread import Spread

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# IST timezone — used for market hours gate
# ---------------------------------------------------------------------------
IST = pytz.timezone("Asia/Kolkata")
MARKET_OPEN  = dt_time(9, 15)
MARKET_CLOSE = dt_time(15, 30)


def _is_market_open() -> bool:
    """
    Returns True only during NSE trading hours (Mon–Fri, 09:15–15:30 IST).

    Why gate on this? Because:
    1. NAVs from MFAPI only update once per day after market close — intraday
       polls return the same value, producing zero-variance z-scores.
    2. Yahoo Finance rate-limits aggressive polling. Polling overnight burns
       quota for useless data.
    3. The rolling window for z-score should contain meaningful price movement,
       not 16 hours of identical values diluting the signal.
    """
    now_ist = datetime.now(IST)
    is_weekday = now_ist.weekday() < 5   # 0 = Mon, 4 = Fri
    is_hours   = MARKET_OPEN <= now_ist.time() <= MARKET_CLOSE
    return is_weekday and is_hours


# ---------------------------------------------------------------------------
# Asset registry
# ---------------------------------------------------------------------------
# Maps internal symbol → Yahoo Finance ticker + MFAPI scheme code.
# To add a new ETF: add one entry here. Nothing else changes.
# ---------------------------------------------------------------------------
ETF_REGISTRY = {
    "NIFTYBEES": {
        "yf_symbol":  "NIFTYBEES.NS",
        "mfapi_code": "140084",          # Nippon India ETF Nifty BeES
        "exchange":   "NSE",
        "name":       "Nippon India ETF Nifty BeES",
        "asset_type": "ETF",
    },
    "JUNIORBEES": {
        "yf_symbol":  "JUNIORBEES.NS",
        "mfapi_code": "140085",          # Nippon India ETF Junior BeES
        "exchange":   "NSE",
        "name":       "Nippon India ETF Junior BeES",
        "asset_type": "ETF",
    },
    "BANKBEES": {
        "yf_symbol":  "BANKBEES.NS",
        "mfapi_code": "140087",          # Nippon India ETF Nifty Bank BeES
        "exchange":   "NSE",
        "name":       "Nippon India ETF Bank BeES",
        "asset_type": "ETF",
    },
    "GOLDBEES": {
        "yf_symbol":  "GOLDBEES.NS",
        "mfapi_code": "140088",          # Nippon India ETF Gold BeES
        "exchange":   "NSE",
        "name":       "Nippon India ETF Gold BeES",
        "asset_type": "ETF",
    },
    "CPSEETF": {
        "yf_symbol":  "CPSEETF.NS",
        "mfapi_code": "140107",          # Nippon India ETF CPSE
        "exchange":   "NSE",
        "name":       "Nippon India ETF CPSE",
        "asset_type": "ETF",
    },
}


# ---------------------------------------------------------------------------
# Helper: get or create asset row
# ---------------------------------------------------------------------------
def _get_or_create_asset(db, symbol: str) -> Asset:
    """
    Looks up an asset by symbol. If it doesn't exist yet, creates it.

    This is the standard "upsert" pattern for reference data. The ETF
    definitions in ETF_REGISTRY are the source of truth; the DB row is
    created lazily on first tick collection.
    """
    asset = db.query(Asset).filter(Asset.symbol == symbol).first()
    if asset is None:
        meta = ETF_REGISTRY[symbol]
        asset = Asset(
            symbol=symbol,
            name=meta["name"],
            asset_type=meta["asset_type"],
            exchange_primary=meta["exchange"],
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        logger.info(f"Created new asset: {symbol} (id={asset.id})")
    return asset


# ---------------------------------------------------------------------------
# Task 1: collect_etf_prices
# ---------------------------------------------------------------------------
@celery_app.task(name="collector.tasks.collect_etf_prices", bind=True, max_retries=3)
def collect_etf_prices(self):
    """
    Fetches market price and NAV for each registered ETF, then:
      - stores a raw PriceTick row in PostgreSQL
      - updates the Redis price hash (latest snapshot)
      - publishes to the Redis price tick stream

    Runs every 15 seconds via Celery Beat.

    Market hours gate: NSE is open Mon-Fri 09:15-15:30 IST. Polling
    outside those hours wastes API quota and inserts meaningless data
    into the z-score rolling window (NAVs don't change intraday).
    """
    # ── Market hours gate ──────────────────────────────────────────────────
    if not _is_market_open():
        now_ist = datetime.now(IST)
        logger.info(
            f"[collector] Outside market hours ({now_ist.strftime('%a %H:%M IST')}) — skipping."
        )
        return

    r = get_redis()
    db = SessionLocal()

    try:
        for symbol, meta in ETF_REGISTRY.items():
            try:
                # --- 1. Fetch data from external sources ---
                market_price = get_yf_price(meta["yf_symbol"])
                nav = get_mfapi_nav(meta["mfapi_code"])

                logger.info(
                    f"[{symbol}] price={market_price:.4f} nav={nav:.4f}"
                )

                # --- 2. Persist raw tick to PostgreSQL ---
                asset = _get_or_create_asset(db, symbol)
                tick = PriceTick(
                    asset_id=asset.id,
                    exchange=meta["exchange"],
                    price=Decimal(str(market_price)),
                    nav=Decimal(str(nav)),
                )
                db.add(tick)
                db.commit()

                # --- 3. Update Redis cache (hash) ---
                r.hset(
                    price_key(symbol),
                    mapping={
                        "price":      str(market_price),
                        "nav":        str(nav),
                        "exchange":   meta["exchange"],
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                )

                # --- 4. Publish raw tick to Redis Stream ---
                r.xadd(
                    PRICE_TICK_STREAM,
                    {
                        "symbol":   symbol,
                        "price":    str(market_price),
                        "nav":      str(nav),
                        "exchange": meta["exchange"],
                    },
                    maxlen=1000,
                    approximate=True,
                )

                logger.info(f"[{symbol}] tick stored and streamed")

            except Exception as exc:
                logger.error(f"[{symbol}] collection failed: {exc}")

    finally:
        db.close()


# ---------------------------------------------------------------------------
# Task 2: compute_spreads
# ---------------------------------------------------------------------------
@celery_app.task(name="collector.tasks.compute_spreads", bind=True, max_retries=3)
def compute_spreads(self):
    """
    Reads latest price snapshots from Redis, computes ETF spread + z-score,
    maintains a rolling history window in Redis, stores a Spread snapshot
    in PostgreSQL, and logs an alert if |z_score| exceeds threshold.

    Also publishes spread analytics (spread_bps + z_score) to the Redis
    Stream so the WebSocket feed delivers live-computed values to the
    frontend SpreadTable — not just raw prices.

    Runs every 15 seconds via Celery Beat (after collect_etf_prices).
    """
    r = get_redis()
    db = SessionLocal()

    try:
        for symbol in ETF_REGISTRY:
            try:
                # --- 1. Read latest snapshot from Redis ---
                snapshot = r.hgetall(price_key(symbol))
                if not snapshot:
                    logger.warning(
                        f"[{symbol}] No Redis snapshot yet — "
                        "collect_etf_prices may not have run yet."
                    )
                    continue

                market_price = float(snapshot["price"])
                nav = float(snapshot["nav"])

                # --- 2. Compute ETF premium/discount spread ---
                spread_bps = etf_premium_discount(market_price, nav)

                # --- 3. Maintain rolling history in Redis (LPUSH + LTRIM) ---
                hist_key = spread_history_key(symbol)
                r.lpush(hist_key, str(spread_bps))
                r.ltrim(hist_key, 0, settings.SPREAD_WINDOW_SIZE - 1)

                # --- 4. Compute z-score over the rolling window ---
                history = [float(v) for v in r.lrange(hist_key, 0, -1)]
                score = z_score(spread_bps, history)

                logger.info(
                    f"[{symbol}] spread={spread_bps:.2f}bps z_score={score:.3f}"
                )

                # --- 5. Persist spread snapshot to PostgreSQL ---
                asset = db.query(Asset).filter(Asset.symbol == symbol).first()
                if asset is None:
                    logger.error(
                        f"[{symbol}] Asset not found in DB — "
                        "run collect_etf_prices first."
                    )
                    continue

                spread_row = Spread(
                    asset_id=asset.id,
                    spread_type="etf_premium_discount",
                    spread_bps=Decimal(str(round(spread_bps, 4))),
                    z_score=Decimal(str(round(score, 4))),
                )
                db.add(spread_row)
                db.commit()
                db.refresh(spread_row)

                # --- 6. Publish spread analytics to Redis Stream ---
                # This is the key event that drives live SpreadTable updates.
                # collect_etf_prices streams raw price/nav; here we stream
                # the computed spread_bps + z_score so the frontend can update
                # both columns live without a page refresh.
                captured_str = (
                    spread_row.captured_at.isoformat()
                    if spread_row.captured_at
                    else datetime.now(timezone.utc).isoformat()
                )
                r.xadd(
                    PRICE_TICK_STREAM,
                    {
                        "symbol":      symbol,
                        "price":       str(market_price),
                        "nav":         str(nav),
                        "exchange":    ETF_REGISTRY[symbol]["exchange"],
                        "spread_bps":  str(round(spread_bps, 4)),
                        "z_score":     str(round(score, 4)),
                        "captured_at": captured_str,
                    },
                    maxlen=1000,
                    approximate=True,
                )

                # --- 7. Alert if |z_score| exceeds threshold ---
                if abs(score) > settings.Z_SCORE_ALERT_THRESHOLD:
                    direction = "PREMIUM" if spread_bps > 0 else "DISCOUNT"
                    logger.warning(
                        f"[ALERT] {symbol} z_score={score:.3f} — "
                        f"extreme {direction} of {spread_bps:.2f}bps detected. "
                        f"Threshold: ±{settings.Z_SCORE_ALERT_THRESHOLD}"
                    )

            except Exception as exc:
                logger.error(f"[{symbol}] spread computation failed: {exc}")

    finally:
        db.close()