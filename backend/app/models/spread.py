from sqlalchemy import Column, BigInteger, ForeignKey, String, Numeric, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class Spread(Base):
    __tablename__ = "spreads"

    id = Column(BigInteger, primary_key=True)

    asset_id = Column(
        UUID(as_uuid=True),
        ForeignKey("assets.id"),
        nullable=False
    )

    spread_type = Column(String(30))

    spread_bps = Column(Numeric(10, 4))

    z_score = Column(Numeric(8, 4))

    captured_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )