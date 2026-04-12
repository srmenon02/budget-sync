import uuid

from sqlalchemy import Column, Integer, Numeric, String, Text

from ..database import Base


class Account(Base):
    __tablename__ = "financial_accounts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)
    provider = Column(String(50), nullable=True)
    external_id = Column(String(255), nullable=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=True)
    balance_current = Column(Numeric(12, 2), nullable=True)
    currency = Column(String(10), nullable=True, default="USD")
    account_class = Column(String(20), nullable=False, default="asset")
    credit_limit = Column(Numeric(12, 2), nullable=True)
    statement_due_day = Column(Integer, nullable=True)
    minimum_due = Column(Numeric(12, 2), nullable=True)
    apr = Column(Numeric(8, 4), nullable=True)
    teller_access_token_enc = Column(Text, nullable=True)
    last_synced_at = Column(String(50), nullable=True)
