from sqlalchemy import Column, Numeric, String, Text
import uuid

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
    currency = Column(String(10), nullable=True, default='USD')
    teller_access_token_enc = Column(Text, nullable=True)
    last_synced_at = Column(String(50), nullable=True)
