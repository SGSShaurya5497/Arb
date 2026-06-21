"""fix_assets_column_lengths_and_uuid_default

Revision ID: a1b2c3d4e5f6
Revises: fef87eed51fa
Create Date: 2026-06-21

Fixes two bugs introduced in the initial migration:

1. name, asset_type, exchange_primary, exchange_secondary were created as
   VARCHAR(20) but the SQLAlchemy model specifies VARCHAR(200). Real ETF
   names like "Nippon India ETF Nifty BeES" exceed 20 characters.

2. The assets.id column has no server-side default. Adding gen_random_uuid()
   so that raw SQL inserts (migrations, seed scripts, admin tools) don't
   require the caller to supply a UUID manually.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'fef87eed51fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # Fix 1: Extend VARCHAR columns from 20 → 200 characters.
    #
    # ALTER COLUMN ... TYPE is safe on PostgreSQL — it does not rewrite the
    # table if the new size is larger. It only updates the constraint.
    # -----------------------------------------------------------------------
    op.alter_column(
        'assets', 'name',
        existing_type=sa.String(20),
        type_=sa.String(200),
        existing_nullable=False
    )
    op.alter_column(
        'assets', 'asset_type',
        existing_type=sa.String(20),
        type_=sa.String(200),
        existing_nullable=False
    )
    op.alter_column(
        'assets', 'exchange_primary',
        existing_type=sa.String(20),
        type_=sa.String(200),
        existing_nullable=False
    )
    op.alter_column(
        'assets', 'exchange_secondary',
        existing_type=sa.String(20),
        type_=sa.String(200),
        existing_nullable=True
    )

    # -----------------------------------------------------------------------
    # Fix 2: Add server-side UUID default to assets.id.
    #
    # gen_random_uuid() is a built-in PostgreSQL function (available from
    # Postgres 13+ without needing the pgcrypto extension).
    # This means even raw SQL INSERT without an explicit id will work.
    # -----------------------------------------------------------------------
    op.execute(
        "ALTER TABLE assets ALTER COLUMN id SET DEFAULT gen_random_uuid()"
    )


def downgrade() -> None:
    # Remove the server default (revert to requiring explicit UUID on insert)
    op.execute(
        "ALTER TABLE assets ALTER COLUMN id DROP DEFAULT"
    )

    # Shrink columns back to 20 chars (WARNING: data truncation if values > 20)
    op.alter_column(
        'assets', 'exchange_secondary',
        existing_type=sa.String(200),
        type_=sa.String(20),
        existing_nullable=True
    )
    op.alter_column(
        'assets', 'exchange_primary',
        existing_type=sa.String(200),
        type_=sa.String(20),
        existing_nullable=False
    )
    op.alter_column(
        'assets', 'asset_type',
        existing_type=sa.String(200),
        type_=sa.String(20),
        existing_nullable=False
    )
    op.alter_column(
        'assets', 'name',
        existing_type=sa.String(200),
        type_=sa.String(20),
        existing_nullable=False
    )
