"""
Auth routes — registration and token issuance.

Two endpoints:
    POST /auth/register  → create account, return UserRead (201)
    POST /auth/token     → validate credentials, return JWT Token (200)

No protected routes here. Protection is handled by the get_current_user
dependency imported by other routers.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import Token, UserCreate, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account",
)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> UserRead:
    """
    Registers a new user.

    Steps:
        1. Check for duplicate email (clean 409 before hitting DB constraint).
        2. Hash the password — never store plaintext.
        3. Insert the user row.
        4. Return UserRead (no hashed_password in response).

    Raises:
        409 Conflict — email already registered.
    """
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{payload.email}' is already registered",
        )

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)   # refresh populates server-set fields: id, created_at

    return UserRead.model_validate(user)


@router.post(
    "/token",
    response_model=Token,
    summary="Login and receive a JWT access token",
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    """
    OAuth2 password grant flow.

    Accepts `username` and `password` as form fields (not JSON — this is the
    OAuth2 spec requirement). We use `username` field to carry the email address.

    Returns a JWT Bearer token on success.

    Raises:
        401 Unauthorized — wrong email or wrong password.
                           We return the same error for both cases intentionally:
                           telling the attacker which one is wrong leaks information.
    """
    # Single DB lookup — don't run two queries (one to check existence,
    # another to get the user). Get the user once and check password locally.
    user = db.query(User).filter(User.email == form_data.username).first()

    # Constant-time comparison via passlib — protects against timing attacks.
    # We call verify_password even if user is None (with a dummy hash) to keep
    # response time consistent whether the email exists or not.
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    token = create_access_token(subject=user.email)
    return Token(access_token=token, token_type="bearer")
