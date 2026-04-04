from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class TransactionCreate(BaseModel):
    account_id: Optional[str] = None
    external_id: Optional[str] = None
    amount: float
    description: Optional[str] = None
    merchant_name: Optional[str] = None
    category: Optional[str] = None
    date: date
    notes: Optional[str] = None
    is_manual: Optional[bool] = False


class TransactionRead(TransactionCreate):
    id: str
    transaction_date: date = Field(alias="date")

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    transactions: list[TransactionRead]
    total_count: int
    page: int
    limit: int
