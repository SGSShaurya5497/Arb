from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

# ---------------------------------------------------------------------------
# Celery app object
# ---------------------------------------------------------------------------
# This is the central object that both the worker and Beat scheduler share.
#
# broker_url   — where tasks are published (Redis queue)
# backend      — where task results/return values are stored (Redis)
# include      — list of modules Celery will import to discover @task functions
# ---------------------------------------------------------------------------
celery_app = Celery(
    "arb_collector",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["collector.tasks"],     # tells Celery where our tasks live
)

# ---------------------------------------------------------------------------
# Celery configuration
# ---------------------------------------------------------------------------
celery_app.conf.update(
    # Serialize task arguments as JSON (human-readable, language-agnostic).
    # Default is pickle which has security issues.
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # All datetimes in UTC — critical for a financial system.
    timezone="UTC",
    enable_utc=True,

    # Don't store results unless we explicitly need them.
    # Spread results are stored in PostgreSQL, not in Celery's result backend.
    task_ignore_result=True,
)

# ---------------------------------------------------------------------------
# Beat schedule — periodic tasks
# ---------------------------------------------------------------------------
# Celery Beat is the scheduler process. It reads this dict and fires tasks
# at the specified intervals. Both tasks run every 15 seconds.
#
# Why 15 seconds? Arbitrage windows in Indian markets can close in seconds.
# 15s gives us meaningful real-time data without hammering the APIs.
# ---------------------------------------------------------------------------
celery_app.conf.beat_schedule = {
    "collect-etf-prices-every-15s": {
        "task": "collector.tasks.collect_etf_prices",
        "schedule": 15.0,           # seconds (float supported by Celery Beat)
    },
    "compute-spreads-every-15s": {
        "task": "collector.tasks.compute_spreads",
        "schedule": 15.0,
    },
}
