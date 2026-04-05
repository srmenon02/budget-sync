import uuid

from sqlalchemy import Column, Numeric, String, UniqueConstraint
from sqlalchemy.sql import func

from ..database import Base


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint("user_id", "category", "month", "year", "period", name="uq_budget_user_category_month_year_period"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    category = Column(String(100), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    month = Column(String(7), nullable=False)  # Format: YYYY-MM
    year = Column(String(4), nullable=False)
    period = Column(String(20), nullable=False, default="monthly")
    created_at = Column(String(50), server_default=func.now())
