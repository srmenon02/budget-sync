import uuid
from datetime import datetime

from sqlalchemy import (Boolean, DateTime, ForeignKey, Numeric, String, Text,
                        func)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship("User", back_populates="budgets")


class BudgetArchive(Base):
    """Stores exported/archived budgets with their historical transaction data."""

    __tablename__ = "budget_archives"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    budget_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("budgets.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    spent_amount: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    transactions_data: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # JSON string of transactions
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    archived_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    owner: Mapped["User"] = relationship("User")
