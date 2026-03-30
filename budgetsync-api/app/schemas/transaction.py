from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class TransactionCreate(BaseModel):
    account_id: Optional[str]
    external_id: Optional[str]
    amount: float
    description: Optional[str]
    merchant_name: Optional[str]
    category: Optional[str]
    date: date
    notes: Optional[str] = None
    is_manual: Optional[bool] = False


class TransactionRead(TransactionCreate):
    id: str

    model_config = {"from_attributes": True}
