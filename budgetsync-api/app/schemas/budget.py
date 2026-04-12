from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field

BudgetPeriod = Literal["monthly", "paycheck"]


class BudgetUpsert(BaseModel):
    category: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    period: BudgetPeriod = "monthly"
    paycheck_number: Optional[int] = None  # Paycheck index when period is "paycheck"


class BudgetBulkItem(BaseModel):
    category: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    paycheck_number: Optional[int] = None


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
    paycheck_number: Optional[int] = None

    model_config = {"from_attributes": True}


class BudgetActualRead(BaseModel):
    category: str
    limit: float
    spent: float
    remaining: float
    over_budget: bool
    period: BudgetPeriod
    paycheck_number: Optional[int] = None


class BudgetCurrentResponse(BaseModel):
    month: str
    period: BudgetPeriod
    range_start: date
    range_end: date
    budgets: list[BudgetActualRead]
