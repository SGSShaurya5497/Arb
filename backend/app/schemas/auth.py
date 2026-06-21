"""
Auth schemas — Pydantic models for request bodies and response payloads.

Rule: Never return a SQLAlchemy model directly from a route. Always pass
through a schema. This gives you explicit control over what is serialized
and prevents accidentally exposing fields like hashed_password.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


# ---------------------------------------------------------------------------
# Request schemas (what the client sends)
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    """
    Body for POST /auth/register.

    EmailStr validates format (requires `email-validator` package, which
    pydantic pulls in automatically). We don't check domain-existence here —
    that would require a DNS lookup and is out of scope for auth.
    """
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        """
        Enforce a minimum password length at the schema level, not in the route.
        This way the validation error message is consistent and automatic.
        8 chars is the NIST SP 800-63B minimum for user-chosen passwords.
        """
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# ---------------------------------------------------------------------------
# Response schemas (what the API returns)
# ---------------------------------------------------------------------------

class UserRead(BaseModel):
    """
    Response for POST /auth/register and GET /auth/me.

    Notice: hashed_password is NOT here. Pydantic only serializes fields
    declared in the schema — this is the safety guarantee.
    """
    id: uuid.UUID
    email: EmailStr
    is_active: bool
    created_at: datetime

    # model_config replaces the old class Config with from_orm = True.
    # from_orm (now called from_attributes) lets Pydantic read data from
    # SQLAlchemy model attributes instead of dicts.
    model_config = {"from_attributes": True}


class Token(BaseModel):
    """
    Response for POST /auth/token (the login endpoint).

    OAuth2 spec requires this exact shape. `token_type` must be "bearer"
    (lowercase). The frontend stores `access_token` and sends it as:
        Authorization: Bearer <access_token>
    """
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """
    Internal schema — used inside get_current_user() to hold the decoded
    JWT subject. Never returned to clients directly.
    """
    email: str
