import uuid

from sqlalchemy import Boolean, Column, Date, Integer, Numeric, String, Text
from sqlalchemy.sql import func

from ..database import Base


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
    tx_type = Column(String(20), nullable=False, default="expense")
    date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    is_manual = Column(Boolean, default=False)
    loan_id = Column(String(36), nullable=True)  # Link to loan for auto-balance updates
    is_paid_off = Column(Boolean, default=False)  # For credit card transactions tracking
    paycheck_number = Column(Integer, nullable=True)  # Paycheck index (1, 2, 3, etc.)
    created_at = Column(String(50), server_default=func.now())
