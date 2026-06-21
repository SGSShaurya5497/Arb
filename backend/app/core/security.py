"""
security.py — pure crypto functions with no FastAPI dependency.

This module is intentionally framework-agnostic: it only deals with
password hashing and JWT encode/decode. Routes and dependencies import
from here, not the reverse.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
# CryptContext handles scheme migration transparently: if you later add
# "argon2" to schemes, existing bcrypt hashes keep verifying while new
# registrations use argon2. No manual migration scripts needed.
# deprecated="auto" marks old schemes as deprecated in verify() output.
# ---------------------------------------------------------------------------
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """
    Returns a bcrypt hash of the plaintext password.

    bcrypt is intentionally slow (default cost factor ~12 rounds = ~250ms
    on modern hardware). That's the security property — it makes offline
    brute-force attacks expensive, not just infeasible in theory.
    """
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Returns True if `plain` matches the stored `hashed` value.

    Uses constant-time comparison internally to prevent timing attacks.
    Never roll your own comparison — use this or an equivalent library call.
    """
    return _pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------
# We use HS256 (HMAC-SHA256): a single symmetric key signs and verifies.
# This is correct when one service is both issuer and verifier.
# RS256 (asymmetric) is needed when external services need to verify tokens
# without receiving the private key — not our case here.
# ---------------------------------------------------------------------------

def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Creates a signed JWT access token.

    Args:
        subject: The identity claim — we use the user's email string.
                 Could be a UUID, but email is more readable in logs.
        expires_delta: Override the default expiry. Used in tests to create
                       short-lived or already-expired tokens.

    Returns:
        A signed JWT string ready to embed in an Authorization header.
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": subject,   # "sub" (subject) is a registered JWT claim name — RFC 7519
        "exp": expire,    # "exp" (expiry) — jose validates this automatically on decode
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[str]:
    """
    Decodes and validates a JWT, returning the subject (email) if valid.

    Returns None instead of raising on invalid tokens so the caller
    (get_current_user dependency) can return a clean 401 instead of a 500.

    Handles:
        - Expired tokens (JWTError with exp claim in the past)
        - Tampered signatures
        - Malformed token strings
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload.get("sub")
    except JWTError:
        return None
