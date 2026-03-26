import uuid
from datetime import date, datetime
from pydantic import BaseModel


class TransactionBase(BaseModel):
    amount: float
    merchant_name: str | None = None
    description: str | None = None
    category: str | None = None
    transaction_date: date


class TransactionCreate(TransactionBase):
    account_id: uuid.UUID
    is_manual: bool = True


class TransactionUpdate(BaseModel):
    merchant_name: str | None = None
    category: str | None = None
    description: str | None = None


class TransactionResponse(TransactionBase):
    id: uuid.UUID
    account_id: uuid.UUID
    is_manual: bool
    created_at: datetime

    model_config = {"from_attributes": True}