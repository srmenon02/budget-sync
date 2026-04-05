from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import date as dt_date


class TransactionCreate(BaseModel):
    account_id: Optional[str] = None
    external_id: Optional[str] = None
    amount: float
    description: Optional[str] = None
    merchant_name: Optional[str] = None
    category: Optional[str] = None
    date: dt_date
    notes: Optional[str] = None
    is_manual: Optional[bool] = False
    loan_id: Optional[str] = None  # Link to loan for auto-balance updates


class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    merchant_name: Optional[str] = None
    category: Optional[str] = None
    date: Optional[dt_date] = None
    notes: Optional[str] = None
    loan_id: Optional[str] = None


class TransactionRead(TransactionCreate):
    id: str
    transaction_date: dt_date = Field(alias="date")

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    transactions: list[TransactionRead]
    total_count: int
    page: int
    limit: int


class TransactionBulkItem(BaseModel):
    amount: float = Field(gt=0)
    description: Optional[str] = None
    merchant_name: Optional[str] = None
    category: Optional[str] = None
    date: dt_date = Field(default_factory=dt_date.today)
    notes: Optional[str] = None
    tx_type: Literal["income", "expense"] = "expense"


class TransactionBulkCreate(BaseModel):
    account_id: str
    items: list[TransactionBulkItem]
