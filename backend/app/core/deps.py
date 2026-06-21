"""
deps.py — FastAPI dependency factories.

These are the Depends() callables imported by route handlers.
Keeping them in one place avoids circular imports: api/* imports from deps,
deps imports from core/*, and core/* never imports from api/*.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.redis_client import get_redis
from app.core.security import decode_access_token
from app.models.user import User

# ---------------------------------------------------------------------------
# Database session
# ---------------------------------------------------------------------------
# Re-exported here so routes only need to import from deps, not from two
# different core modules. This also makes swapping the DB backend easier:
# change one place, all routes automatically pick up the new implementation.
# ---------------------------------------------------------------------------

def get_db():
    """
    Yields a synchronous SQLAlchemy session, guaranteed to close.

    Why sync and not async? The Celery collector (Phase 3) already uses sync
    sessions. Introducing AsyncSession here would require a second engine,
    second connection pool, and converting every model access in both layers.
    Sync sessions inside async FastAPI routes are perfectly valid for this
    scale — each request holds a session for <10ms of DB time.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Redis client
# ---------------------------------------------------------------------------

def get_redis_dep():
    """
    Yields the shared Redis client from the module-level connection pool.
    Used by the WebSocket broadcaster and any route that reads from Redis.
    """
    return get_redis()


# ---------------------------------------------------------------------------
# JWT auth
# ---------------------------------------------------------------------------
# OAuth2PasswordBearer tells FastAPI:
#   1. Extract the token from the `Authorization: Bearer <token>` header.
#   2. Mark this route as requiring auth in the OpenAPI spec (shows the
#      padlock icon in /docs and enables the "Authorize" button).
# The tokenUrl points at our login endpoint so /docs can auto-fill the form.
# ---------------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Decodes the JWT bearer token and returns the authenticated User.

    Raises HTTP 401 Unauthorized if:
        - Token is missing (OAuth2PasswordBearer handles this automatically)
        - Token signature is invalid or expired
        - The user in the token no longer exists in the database
        - The user's is_active flag is False (soft-disabled account)

    Usage in a route:
        @router.get("/protected")
        def protected(user: User = Depends(get_current_user)):
            return {"email": user.email}
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials",
        # WWW-Authenticate header is required by RFC 6750 for bearer token 401s.
        headers={"WWW-Authenticate": "Bearer"},
    )

    email = decode_access_token(token)
    if email is None:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    return user
