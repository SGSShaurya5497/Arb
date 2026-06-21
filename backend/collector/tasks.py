from celery import Celery

from redis import Redis

from app.core.database import SessionLocal
from app.models.price_tick import PriceTick
from app.models.spread import Spread

from collector.data_sources import (
    get_nse_price,
    get_mfapi_nav,
)

from collector.spreads import (
    etf_premium_discount,
    z_score,
)

app = Celery(
    "collector",
    broker="redis://redis:6379/0"
)

redis_client = Redis(
    host="redis",
    port=6379,
    db=0,
    decode_responses=True
)


@app.task
def collect_etf_prices():

    db = SessionLocal()

    try:

        # TODO:
        # Replace with actual asset lookup from assets table
        asset_id = "PUT_REAL_ASSET_ID_HERE"

        etf_price = get_nse_price("NIFTYBEES")

        nav = get_mfapi_nav("119551")

        tick = PriceTick(
            asset_id=asset_id,
            exchange="NSE",
            price=etf_price,
            nav=nav
        )

        db.add(tick)
        db.commit()

        redis_client.hset(
            f"arb:latest:{asset_id}",
            mapping={
                "price": float(etf_price),
                "nav": float(nav)
            }
        )

        redis_client.xadd(
            "arb:stream",
            {
                "asset_id": str(asset_id),
                "price": float(etf_price),
                "nav": float(nav)
            }
        )

        print("ETF price collected")

    finally:
        db.close()


@app.task
def compute_spreads():

    db = SessionLocal()

    try:

        # TODO:
        # Replace with actual asset lookup
        asset_id = "PUT_REAL_ASSET_ID_HERE"

        latest = redis_client.hgetall(
            f"arb:latest:{asset_id}"
        )

        if not latest:
            return

        price = float(latest["price"])
        nav = float(latest["nav"])

        spread_bps = etf_premium_discount(
            price,
            nav
        )

        history = redis_client.lrange(
            f"arb:rolling:{asset_id}",
            0,
            -1
        )

        history = [float(x) for x in history]

        score = z_score(
            spread_bps,
            history
        )

        redis_client.lpush(
            f"arb:rolling:{asset_id}",
            spread_bps
        )

        redis_client.ltrim(
            f"arb:rolling:{asset_id}",
            0,
            19
        )

        spread = Spread(
            asset_id=asset_id,
            spread_type="ETF_PREMIUM",
            spread_bps=spread_bps,
            z_score=score
        )

        db.add(spread)
        db.commit()

        if abs(score) > 2:
            print(
                f"ALERT: z-score = {score}"
            )

    finally:
        db.close()


app.conf.beat_schedule = {
    "collect-every-15s": {
        "task": "collector.tasks.collect_etf_prices",
        "schedule": 15.0,
    },
    "spreads-every-15s": {
        "task": "collector.tasks.compute_spreads",
        "schedule": 15.0,
    },
}