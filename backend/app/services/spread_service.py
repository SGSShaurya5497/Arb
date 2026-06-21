"""
spread_service.py — DB query logic for spread and alert endpoints.

All functions accept a SQLAlchemy Session and return ORM objects or tuples.
They never import FastAPI — this keeps them framework-agnostic and testable
with a plain db fixture without starting an HTTP server.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.assets import Asset
from app.models.spread import Spread


def get_current_spreads(db: Session) -> List[Tuple[Asset, Optional[Spread]]]:
    """
    Returns the latest spread snapshot for every tracked asset.

    Strategy: For each asset, find the spread row with the maximum
    captured_at timestamp. This is a correlated subquery — efficient on
    indexed captured_at even with millions of rows.

    Returns a list of (Asset, Spread | None) tuples. An asset can have
    Spread=None if no spreads have been computed yet (e.g., just after
    the collector starts for the first time).
    """
    # Subquery: max captured_at per asset_id in spreads table.
    # We do this as a subquery so SQLAlchemy emits one round-trip query.
    latest_subq = (
        db.query(
            Spread.asset_id,
            func.max(Spread.captured_at).label("max_captured_at"),
        )
        .group_by(Spread.asset_id)
        .subquery()
    )

    # Left join assets → latest spread.
    # LEFT join means assets with no spreads still appear (Spread will be None).
    rows = (
        db.query(Asset, Spread)
        .outerjoin(
            latest_subq,
            Asset.id == latest_subq.c.asset_id,
        )
        .outerjoin(
            Spread,
            (Spread.asset_id == latest_subq.c.asset_id)
            & (Spread.captured_at == latest_subq.c.max_captured_at),
        )
        .order_by(Asset.symbol)
        .all()
    )

    return rows


def get_spread_history(
    db: Session,
    asset_id: uuid.UUID,
    days: int = 30,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[Spread], int]:
    """
    Returns paginated spread history for a single asset.

    Args:
        asset_id: UUID of the asset.
        days: How many calendar days back to look. Default 30.
        page: 1-indexed page number.
        page_size: Rows per page. Capped at 100 to prevent runaway queries.

    Returns:
        (rows, total_count) tuple. `total_count` is across all pages so
        the frontend can compute total pages without a second API call.

    Raises:
        Nothing — if asset_id doesn't exist, rows will be empty and total=0.
        The route handler checks asset existence separately and returns 404.
    """
    page_size = min(page_size, 100)  # hard cap — never return >100 rows per call
    offset = (page - 1) * page_size

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    base_query = (
        db.query(Spread)
        .filter(Spread.asset_id == asset_id)
        .filter(Spread.captured_at >= cutoff)
    )

    total = base_query.count()
    rows = (
        base_query
        .order_by(Spread.captured_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return rows, total


def get_alerts(
    db: Session,
    threshold: float = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[Tuple[Spread, str]], int]:
    """
    Returns spread snapshots where |z_score| > threshold, sorted by severity.

    The threshold defaults to settings.Z_SCORE_ALERT_THRESHOLD (2.0) so
    this function stays consistent with the collector's alert logic.

    Returns rows joined with the asset symbol (needed by AlertRead schema).
    """
    if threshold is None:
        threshold = settings.Z_SCORE_ALERT_THRESHOLD

    page_size = min(page_size, 100)
    offset = (page - 1) * page_size

    # func.abs() is a SQLAlchemy expression that maps to SQL ABS().
    # We filter and sort by the same expression so the most extreme spreads
    # appear first — highest |z_score| = highest severity = top of list.
    base_query = (
        db.query(Spread, Asset.symbol)
        .join(Asset, Spread.asset_id == Asset.id)
        .filter(func.abs(Spread.z_score) > threshold)
    )

    total = base_query.count()
    rows = (
        base_query
        .order_by(func.abs(Spread.z_score).desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return rows, total
