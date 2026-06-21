import uuid

from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.sql.expression import text

from app.core.database import Base


class User(Base):
    """
    Application user — owns authenticated sessions.

    Deliberately minimal: email + hashed password + active flag.
    Do NOT add financial data here; users and market data are separate domains.
    """

    __tablename__ = "users"

    # UUID primary key with both a Python-side default (ORM inserts) and a
    # server-side default (raw SQL inserts, migrations, admin tools).
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        unique=True,
        nullable=False,
    )

    # Lowercased email is the login identity. index=True because every
    # authentication check is a lookup by email.
    email = Column(String(255), unique=True, nullable=False, index=True)

    # Never store plaintext passwords. This column holds the bcrypt hash.
    # bcrypt hashes are always 60 characters; 255 is future-safe.
    hashed_password = Column(String(255), nullable=False)

    # Soft-delete flag. Setting is_active=False disables login without
    # destroying audit history. DELETE FROM users should never happen in prod.
    is_active = Column(Boolean, default=True, nullable=False)

    # Immutable audit timestamp — set by Postgres, never by application code.
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
