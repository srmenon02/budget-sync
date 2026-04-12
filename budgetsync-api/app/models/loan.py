import uuid

from sqlalchemy import Column, Float, ForeignKey, Numeric, String
from sqlalchemy.sql import func

from ..database import Base


class Loan(Base):
    __tablename__ = "loans"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    name = Column(String(255), nullable=False)
    principal_amount = Column(Numeric(12, 2), nullable=False)
    current_balance = Column(Numeric(12, 2), nullable=False)
    interest_rate = Column(Float, nullable=False, default=0.0)
    start_date = Column(String(10), nullable=True)  # YYYY-MM-DD
    created_at = Column(String(50), server_default=func.now())
    updated_at = Column(String(50), server_default=func.now(), onupdate=func.now())


class LoanPayment(Base):
    __tablename__ = "loan_payments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    loan_id = Column(
        String(36), ForeignKey("loans.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(String(36), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    created_at = Column(String(50), server_default=func.now())
