from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Central configuration object for the Arb backend.

    Pydantic reads each field from an environment variable of the same name
    (case-insensitive). If a required field is missing at startup, Pydantic
    raises a ValidationError immediately — no silent failures.

    Docker Compose injects these via the `environment:` block in
    docker-compose.yml. Locally you can put them in a .env file.
    """

    # --- PostgreSQL ---
    DATABASE_URL: str = "postgresql://arb_user:arb_password@postgres:5432/arb"

    # --- Redis ---
    REDIS_URL: str = "redis://redis:6379/0"

    # --- Celery ---
    # Celery uses Redis as both the message broker (task queue) and the
    # result backend (where task return values are stored).
    # We point both at the same Redis instance for simplicity.
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/0"

    # --- Rolling window ---
    # How many historical spread values to keep in Redis per asset.
    # The z-score is computed over this window.
    SPREAD_WINDOW_SIZE: int = 20

    # --- Alert threshold ---
    Z_SCORE_ALERT_THRESHOLD: float = 2.0

    class Config:
        # If a .env file exists next to the process, load it automatically.
        # Docker Compose environment variables always take precedence over .env.
        env_file = ".env"
        env_file_encoding = "utf-8"


# Module-level singleton — import `settings` anywhere in the project.
# Pydantic reads env vars exactly once at import time.
settings = Settings()