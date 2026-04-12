import uuid
from datetime import date, datetime

from sqlalchemy import (Boolean, Date, DateTime, ForeignKey, Numeric, String,
                        func)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("financial_accounts.id", ondelete="CASCADE"), nullable=False
    )
    budget_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("budgets.id", ondelete="SET NULL"), nullable=True
    )
    teller_transaction_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    merchant_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    account: Mapped["FinancialAccount"] = relationship(
        "FinancialAccount", back_populates="transactions"
    )
