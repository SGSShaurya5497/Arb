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
                                     → log alert if |z_score| > threshold
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal

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
# Asset registry
# ---------------------------------------------------------------------------
# This dict maps the ETF symbol we use internally to its two data sources:
#   yf_symbol   → the Yahoo Finance ticker (needed for market price)
#   mfapi_code  → the MFAPI scheme code (needed for NAV)
#
# Why hardcode this here? Because NSE/BSE symbols and MFAPI codes are
# different naming systems. We need an explicit mapping. As you add more ETFs,
# you extend this dict and nothing else changes.
#
# NIFTYBEES is the Nippon India ETF tracking Nifty 50 — the most liquid ETF
# in India and the primary arbitrage candidate.
# ---------------------------------------------------------------------------
ETF_REGISTRY = {
    "NIFTYBEES": {
        "yf_symbol": "NIFTYBEES.NS",   # .NS suffix = NSE-listed on Yahoo Finance
        "mfapi_code": "140084",         # Nippon India ETF Nifty BeES scheme code
        "exchange": "NSE",
        "name": "Nippon India ETF Nifty BeES",
        "asset_type": "ETF",
    },
    "JUNIORBEES": {
        "yf_symbol": "JUNIORBEES.NS",
        "mfapi_code": "140085",         # Nippon India ETF Junior BeES
        "exchange": "NSE",
        "name": "Nippon India ETF Junior BeES",
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

    bind=True → gives us access to `self` so we can call self.retry()
    max_retries=3 → if an API call fails, retry up to 3 times before
                     marking the task as failed.
    """
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
                # This is the immutable history record. We never update ticks.
                # captured_at uses server_default=now() so Postgres sets it.
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
                # Redis hashes store field→value pairs under one key.
                # hset with mapping= sets multiple fields atomically.
                # This is what compute_spreads() will read 15 seconds later.
                r.hset(
                    price_key(symbol),
                    mapping={
                        "price": str(market_price),
                        "nav": str(nav),
                        "exchange": meta["exchange"],
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                )

                # --- 4. Publish to Redis Stream ---
                # XADD appends an entry to the stream.
                # maxlen=1000 keeps only the last 1000 entries (sliding window).
                # "~" means approximate — Redis may keep slightly more for
                # performance, but no more than 10% over the limit.
                r.xadd(
                    PRICE_TICK_STREAM,
                    {
                        "symbol": symbol,
                        "price": str(market_price),
                        "nav": str(nav),
                        "exchange": meta["exchange"],
                    },
                    maxlen=1000,
                    approximate=True,
                )

                logger.info(f"[{symbol}] tick stored and streamed")

            except Exception as exc:
                # Log the per-symbol error but continue to the next symbol.
                # We don't want one broken ETF to abort collection for all.
                logger.error(f"[{symbol}] collection failed: {exc}")

    finally:
        # Always close the DB session, even if something above raised.
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

    Runs every 15 seconds via Celery Beat (after collect_etf_prices).

    Design: We read from Redis (not Postgres) because Redis is in-memory
    and returns data in microseconds. Postgres would require a round-trip
    query. For a 15-second cycle, this matters — especially at scale.
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
                # Positive value → ETF trading at a premium to NAV
                # Negative value → ETF trading at a discount to NAV
                # Value is in basis points (1 bps = 0.01%)
                spread_bps = etf_premium_discount(market_price, nav)

                # --- 3. Maintain rolling history in Redis (LPUSH + LTRIM) ---
                # LPUSH pushes the new value to the HEAD of the list.
                # LTRIM keeps only the first N elements (our window).
                # Together they implement a sliding window with O(1) writes.
                hist_key = spread_history_key(symbol)
                r.lpush(hist_key, str(spread_bps))
                r.ltrim(hist_key, 0, settings.SPREAD_WINDOW_SIZE - 1)

                # --- 4. Compute z-score over the rolling window ---
                # LRANGE returns all elements in the list as strings.
                # We convert to floats and pass to our z_score() function.
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

                # --- 6. Alert if |z_score| exceeds threshold ---
                # In production this would send a Slack message, push
                # notification, or trigger a trading signal. For now we
                # log at WARNING level so it's visible in monitoring.
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
