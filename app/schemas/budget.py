import uuid
from datetime import datetime
from pydantic import BaseModel, field_validator


class BudgetBase(BaseModel):
    category: str
    amount: float
    month: int
    year: int

    @field_validator("month")
    @classmethod
    def validate_month(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("month must be between 1 and 12")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    amount: float | None = None


class BudgetResponse(BudgetBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class BudgetWithActual(BudgetResponse):
    actual_spent: float
    remaining: float
    percent_used: float