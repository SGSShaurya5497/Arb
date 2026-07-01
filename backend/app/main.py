"""
main.py — FastAPI application entry point.

Wiring order matters:
    1. Create `app` and add middleware (CORS must be before routers)
    2. Register the slowapi rate limiter exception handler
    3. Include all routers
    4. Register the WebSocket Redis reader as a lifespan startup task
"""

import asyncio
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api import alerts, auth, spreads, ws
from app.api.spreads import limiter   # single shared Limiter instance
from app.core.config import settings
from app.core.database import engine, SessionLocal, Base
from app.models.assets import Asset

# ETF_REGISTRY is the single source of truth for tracked instruments.
# We import it here to seed the DB on startup — this way the SpreadTable
# shows all instruments immediately, even before the collector has run.
from collector.tasks import ETF_REGISTRY

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Arb — Real-Time Arbitrage Tracker",
    description=(
        "FastAPI backend for tracking ETF premium/discount spreads across "
        "Indian markets. JWT-authenticated REST + live WebSocket feed."
    ),
    version="0.4.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# Rate limiter state
# ---------------------------------------------------------------------------
# slowapi stores per-IP counters in app.state.limiter.
# The middleware reads from there on every request.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ---------------------------------------------------------------------------
# CORS middleware
# ---------------------------------------------------------------------------
# Must be added BEFORE routers — middleware wraps the app in registration order.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(spreads.router)
app.include_router(alerts.router)
app.include_router(ws.router)   # WebSocket: /ws/spreads


# ---------------------------------------------------------------------------
# WebSocket background task (Redis stream reader)
# ---------------------------------------------------------------------------
# We start the Redis reader as an asyncio background task on app startup.
# It runs for the lifetime of the process — one reader, N clients.
# On shutdown, FastAPI cancels all background tasks automatically.
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def create_tables():
    """
    Creates all tables defined in the SQLAlchemy models.
    
    This must run BEFORE seed_assets() so the assets table exists.
    """
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")


@app.on_event("startup")
async def seed_assets():
    """
    Ensures every ETF in ETF_REGISTRY has a row in the assets table.

    Why on startup and not in the collector?
    The collector is gated by market hours — it won't run on weekends or
    after hours. If a new ETF is added to ETF_REGISTRY, it would never
    appear in the SpreadTable until the market opens. Seeding here means
    assets appear immediately (with latest_spread=None) as soon as the
    backend restarts, regardless of market hours.

    This is idempotent — querying before inserting makes it safe to run
    on every restart without creating duplicate rows.
    """
    db = SessionLocal()
    try:
        for symbol, meta in ETF_REGISTRY.items():
            exists = db.query(Asset).filter(Asset.symbol == symbol).first()
            if not exists:
                db.add(Asset(
                    symbol=symbol,
                    name=meta["name"],
                    asset_type=meta["asset_type"],
                    exchange_primary=meta["exchange"],
                ))
                logger.info(f"[startup] Seeded asset: {symbol}")
        db.commit()
    finally:
        db.close()


@app.on_event("startup")
async def start_redis_reader():
    """Starts the WebSocket Redis stream reader as a background coroutine."""
    asyncio.create_task(ws._redis_reader(), name="redis_stream_reader")
    logger.info("Redis stream reader task started")


# ---------------------------------------------------------------------------
# Root / health
# ---------------------------------------------------------------------------
@app.get("/", tags=["health"])
def root():
    return {"message": "Arb backend is running", "version": "0.4.0"}


@app.get("/health", tags=["health"])
def health():
    """Verifies the database connection is alive. Used by load balancers."""
    with engine.connect() as _conn:
        pass
    return {"status": "healthy"}

