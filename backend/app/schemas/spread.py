"""
Spread and alert schemas — API contracts for the market data endpoints.

Separation principle:
    - SpreadRead / AlertRead describe what the API returns.
    - The SQLAlchemy Spread and Asset models are never returned directly.
    - PaginatedResponse[T] is a generic wrapper reused by all list endpoints.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, computed_field

# TypeVar used to parameterize the generic pagination wrapper.
T = TypeVar("T")


# ---------------------------------------------------------------------------
# Generic pagination envelope
# ---------------------------------------------------------------------------

class PaginatedResponse(BaseModel, Generic[T]):
    """
    Wraps any list of items with pagination metadata.

    Usage in a route:
        return PaginatedResponse(items=rows, total=count, page=1, page_size=20)

    The frontend can use `total` and `page_size` to render page controls
    without making a separate COUNT query endpoint.
    """
    items: List[T]
    total: int        # total matching rows in DB (across all pages)
    page: int         # current page (1-indexed)
    page_size: int    # items per page


# ---------------------------------------------------------------------------
# Asset schema
# ---------------------------------------------------------------------------

class AssetRead(BaseModel):
    """Lightweight asset summary embedded inside spread responses."""
    id: uuid.UUID
    symbol: str
    name: str
    asset_type: str
    exchange_primary: str
    exchange_secondary: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Spread schemas
# ---------------------------------------------------------------------------

class SpreadRead(BaseModel):
    """
    A single spread snapshot as stored in the `spreads` table.
    Returned by /spreads/{asset_id}/history.
    """
    id: int
    asset_id: uuid.UUID
    spread_type: Optional[str] = None
    spread_bps: Optional[Decimal] = None
    z_score: Optional[Decimal] = None
    captured_at: datetime

    model_config = {"from_attributes": True}


class CurrentSpreadRead(BaseModel):
    """
    Denormalized view for /spreads/current — one entry per tracked asset
    with the asset's metadata embedded (avoids a second API call from the
    frontend to look up the symbol name).
    """
    asset: AssetRead
    latest_spread: Optional[SpreadRead] = None


# ---------------------------------------------------------------------------
# Alert schema
# ---------------------------------------------------------------------------

class AlertRead(BaseModel):
    """
    An alert is a spread where |z_score| > threshold.
    The `severity` field is computed from the absolute z_score so the
    frontend can sort or colour-code without doing math on its side.
    """
    id: int
    asset_id: uuid.UUID
    symbol: str          # denormalized from Asset for convenience
    spread_type: Optional[str] = None
    spread_bps: Optional[Decimal] = None
    z_score: Optional[Decimal] = None
    captured_at: datetime

    @computed_field  # Pydantic v2 — computed at serialization time, not stored
    @property
    def severity(self) -> float:
        """
        Absolute z_score as a float for sorting/display.
        Higher = more statistically extreme = more urgent.
        """
        if self.z_score is None:
            return 0.0
        return abs(float(self.z_score))

    model_config = {"from_attributes": True}


    
