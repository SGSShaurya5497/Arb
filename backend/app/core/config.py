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
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/0"

    # --- Rolling window + alert threshold (used by collector AND API) ---
    SPREAD_WINDOW_SIZE: int = 20
    Z_SCORE_ALERT_THRESHOLD: float = 2.0

    # --- JWT ---
    # SECURITY: Replace this with the output of: openssl rand -hex 32
    # This value is the HMAC signing key for all JWTs issued by this service.
    # If it rotates, all existing tokens are immediately invalidated (users
    # must re-login). Store it as a secret in your deployment environment.
    JWT_SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_run_openssl_rand_hex_32"
    JWT_ALGORITHM: str = "HS256"
    # Short expiry limits blast radius if a token is stolen. The frontend
    # should use a refresh-token flow for longer sessions, but for Phase 4
    # a simple 30-minute bearer token is correct and honest.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # --- CORS ---
    # Which origins may call the API from a browser.
    # Pydantic-settings parses this as a JSON array from the env var, e.g.:
    #   CORS_ORIGINS='["http://localhost:5173","https://arb.example.com"]'
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Module-level singleton — import `settings` anywhere in the project.
settings = Settings()