from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


# SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
DATABASE_URL = "postgresql://arb_user:arb_password@postgres:5432/arb"

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)
Base = declarative_base()