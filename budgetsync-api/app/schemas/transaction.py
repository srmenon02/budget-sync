from datetime import date as dt_date
from typing import Literal, Optional

from pydantic import BaseModel, Field


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
    tx_type: Optional[Literal["income", "expense", "transfer"]] = None
    is_paid_off: Optional[bool] = False  # For credit card transactions
    paycheck_number: Optional[int] = None  # Paycheck index (1, 2, 3, etc.)


class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    merchant_name: Optional[str] = None
    category: Optional[str] = None
    date: Optional[dt_date] = None
    notes: Optional[str] = None
    loan_id: Optional[str] = None
    tx_type: Optional[Literal["income", "expense", "transfer"]] = None
    is_paid_off: Optional[bool] = None
    paycheck_number: Optional[int] = None


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
    paycheck_number: Optional[int] = None


class TransactionBulkCreate(BaseModel):
    account_id: str
    items: list[TransactionBulkItem]
