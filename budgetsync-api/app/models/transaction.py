from sqlalchemy import Column, String, Numeric, Date, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid

from ..database import Base
from sqlalchemy import Integer


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id = Column(String(36), nullable=True)
    external_id = Column(String(255), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(Text, nullable=True)
    merchant_name = Column(String(255), nullable=True)
    category = Column(String(100), nullable=True)
    user_category = Column(String(100), nullable=True)
    date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    is_manual = Column(Boolean, default=False)
    loan_id = Column(String(36), nullable=True)  # Link to loan for auto-balance updates
    created_at = Column(String(50), server_default=func.now())
