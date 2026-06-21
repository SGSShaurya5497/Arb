"""add_users_table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-21

Adds the `users` table required by the Phase 4 JWT authentication layer.

Design notes:
- UUID primary key with gen_random_uuid() server default (consistent with assets table).
- email is indexed + unique: every auth check queries by email.
- hashed_password stores bcrypt output (always 60 chars; 255 is future-safe).
- is_active enables soft-disable without data loss.
- created_at is set by Postgres, not application code, for audit reliability.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            # Server-side default means raw SQL inserts work without supplying a UUID.
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.UniqueConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.PrimaryKeyConstraint('id'),
    )
    # Create the index separately so it has an explicit, readable name.
    # This index is what makes `WHERE email = $1` fast at login time.
    op.create_index(
        index_name='ix_users_email',
        table_name='users',
        columns=['email'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
