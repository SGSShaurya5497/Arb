from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.core.database import Base

class Asset(Base):
    __tablename__ = "assets"
    id=Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, nullable=False)
    symbol=Column(String(255), unique=True, nullable=False)
    name=Column(String(20), unique=True, nullable=False)
    asset_type=Column(String(20), nullable=False)
    exchange_primary=Column(String(20), nullable=False)
    exchange_secondary=Column(String(20), nullable=True)
