from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


BudgetPeriod = Literal["monthly", "paycheck"]


class BudgetUpsert(BaseModel):
    category: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    period: BudgetPeriod = "monthly"


class BudgetBulkItem(BaseModel):
    category: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)


class BudgetBulkUpsert(BaseModel):
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    period: BudgetPeriod = "monthly"
    items: list[BudgetBulkItem]


class BudgetRead(BaseModel):
    id: str
    user_id: str
    category: str
    amount: float
    month: str
    year: str
    period: BudgetPeriod

    model_config = {"from_attributes": True}


class BudgetActualRead(BaseModel):
    category: str
    limit: float
    spent: float
    remaining: float
    over_budget: bool
    period: BudgetPeriod


class BudgetCurrentResponse(BaseModel):
    month: str
    period: BudgetPeriod
    range_start: date
    range_end: date
    budgets: list[BudgetActualRead]
