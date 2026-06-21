from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings


# SQLAlchemy engine — the low-level connection pool to PostgreSQL.
# `settings.DATABASE_URL` reads from the environment variable at startup.
engine = create_engine(settings.DATABASE_URL)

# SessionLocal is a factory. Every time you call SessionLocal() you get
# a new database session. Always close it when done (use as context manager).
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base is the declarative base class all SQLAlchemy models inherit from.
# It holds the shared metadata (table definitions) used by Alembic.
Base = declarative_base()


def get_db():
    """
    FastAPI dependency: yields a database session, guaranteed to close.

    Usage in a route:
        @app.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()