"""
Spread routes — paginated market data endpoints.

All routes require authentication (get_current_user dependency).
All list routes are rate-limited to 100 requests/minute per IP.

Rate limiting is handled by slowapi which wraps the `limits` library.
The `request: Request` parameter is mandatory for slowapi — it reads the
client IP from request.client.host to key the rate limit counter.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.assets import Asset
from app.models.user import User
from app.schemas.spread import (
    AssetRead,
    CurrentSpreadRead,
    PaginatedResponse,
    SpreadRead,
)
from app.services.spread_service import get_current_spreads, get_spread_history

# One Limiter instance per application — shared across all route files via import.
# get_remote_address is a slowapi helper that extracts the client IP.
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/v1/spreads", tags=["spreads"])


@router.get(
    "/current",
    response_model=list[CurrentSpreadRead],
    summary="Latest spread snapshot for all tracked assets",
)
@limiter.limit("100/minute")
def get_current(
    request: Request,                               # required by slowapi
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),        # enforces auth
) -> list[CurrentSpreadRead]:
    """
    Returns one entry per tracked asset with its most recent spread snapshot.

    The response is denormalized: asset metadata is embedded inside each
    entry so the frontend doesn't need to make a separate assets lookup call.

    No pagination here because the number of tracked assets is small (O(10s)).
    If you ever track hundreds of assets, add pagination.
    """
    rows = get_current_spreads(db)
    return [
        CurrentSpreadRead(
            asset=AssetRead.model_validate(asset),
            latest_spread=SpreadRead.model_validate(spread) if spread else None,
        )
        for asset, spread in rows
    ]


@router.get(
    "/{asset_id}/history",
    response_model=PaginatedResponse[SpreadRead],
    summary="Paginated spread history for one asset",
)
@limiter.limit("100/minute")
def get_history(
    request: Request,
    asset_id: uuid.UUID,
    days: int = Query(default=30, ge=1, le=365, description="Lookback window in calendar days"),
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Results per page"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> PaginatedResponse[SpreadRead]:
    """
    Returns the last `days` days of spread/z_score data for one asset,
    sorted newest-first.

    Pagination: use `page` and `page_size`. The response includes `total`
    so the frontend can compute total_pages = ceil(total / page_size).

    Query param validation (`ge=1, le=365`) is handled by FastAPI+Pydantic
    automatically — bad values return a 422 Unprocessable Entity.

    Raises:
        404 Not Found — the asset_id does not exist.
    """
    # Verify asset exists before running the history query.
    # Returns 404 rather than an empty list — empty list is ambiguous
    # (could mean "no data yet" vs "wrong ID").
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found",
        )

    rows, total = get_spread_history(db, asset_id, days=days, page=page, page_size=page_size)

    return PaginatedResponse(
        items=[SpreadRead.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )
