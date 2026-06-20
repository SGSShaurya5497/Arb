from sqlalchemy import Column, Integer, String, Float, DateTime, BigInteger, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base

class PriceTick(Base):
    __tablename__ = "price_ticks"

    id = Column(BigInteger, primary_key=True)

    asset_id = Column(
        UUID(as_uuid=True),
        ForeignKey("assets.id"),
        nullable=False
    )

    exchange = Column(String(10))

    price = Column(Numeric(18, 4))

    nav = Column(Numeric(18, 4))

    captured_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

