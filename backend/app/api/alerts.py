"""
Alerts route — spreads where |z_score| exceeds the configured threshold.

The threshold (2.0 by default) is the same value the Celery collector uses
when logging WARNING-level alerts, keeping the API and the collector
consistent. Both read from settings.Z_SCORE_ALERT_THRESHOLD.
"""

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.spreads import limiter   # re-use the single Limiter instance
from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.spread import AlertRead, PaginatedResponse
from app.services.spread_service import get_alerts

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


@router.get(
    "/",
    response_model=PaginatedResponse[AlertRead],
    summary="Active alerts — spreads where |z_score| exceeds threshold",
)
@limiter.limit("100/minute")
def list_alerts(
    request: Request,
    threshold: float = Query(
        default=None,
        description=(
            f"Z-score threshold (default: {settings.Z_SCORE_ALERT_THRESHOLD}). "
            "Returns spreads where |z_score| exceeds this value."
        ),
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> PaginatedResponse[AlertRead]:
    """
    Returns spread snapshots where the z-score is statistically extreme.

    Results are sorted by |z_score| descending — highest severity first.
    The `severity` field in each AlertRead is the absolute z_score as a
    float, pre-computed so the frontend can display it without client-side math.

    The optional `threshold` query param lets you tune sensitivity on the fly:
        - Lower threshold (e.g. 1.5): more alerts, less severe
        - Higher threshold (e.g. 3.0): fewer alerts, more severe
    """
    rows, total = get_alerts(db, threshold=threshold, page=page, page_size=page_size)

    items = [
        AlertRead(
            id=spread.id,
            asset_id=spread.asset_id,
            symbol=symbol,
            spread_type=spread.spread_type,
            spread_bps=spread.spread_bps,
            z_score=spread.z_score,
            captured_at=spread.captured_at,
        )
        for spread, symbol in rows
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
