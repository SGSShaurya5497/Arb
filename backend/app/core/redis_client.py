import redis

from app.core.config import settings

# ---------------------------------------------------------------------------
# Redis connection pool
# ---------------------------------------------------------------------------
# decode_responses=True  → automatically decode bytes to str on reads.
#                          Without this, every read returns b"123.45" instead
#                          of "123.45" and you have to manually call .decode().
# ---------------------------------------------------------------------------
_pool = redis.ConnectionPool.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    max_connections=20,
)


def get_redis() -> redis.Redis:
    """
    Returns a Redis client backed by the shared connection pool.

    Usage:
        r = get_redis()
        r.hset("price:NIFTYBEES", mapping={"price": "123.45", "nav": "122.10"})

    The connection is automatically returned to the pool when the client
    object is garbage-collected. No manual close() needed.
    """
    return redis.Redis(connection_pool=_pool)


# ---------------------------------------------------------------------------
# Redis key helpers
# ---------------------------------------------------------------------------
# Centralizing key names prevents typos. If you rename a key pattern, you
# only change it here — not in 5 different task functions.
# ---------------------------------------------------------------------------

def price_key(symbol: str) -> str:
    """Hash key storing the latest price snapshot for an asset."""
    return f"price:{symbol}"


def spread_history_key(symbol: str) -> str:
    """List key storing rolling spread history for z-score computation."""
    return f"spread_history:{symbol}"


PRICE_TICK_STREAM = "stream:price_ticks"
"""Redis Stream key where every new price tick is published."""
