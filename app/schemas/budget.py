import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


class BudgetCreate(BaseModel):
    name: str
    total_amount: float

    @field_validator("total_amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("total_amount must be positive")
        return v


class BudgetUpdate(BaseModel):
    name: str | None = None
    total_amount: float | None = None


class BudgetResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    total_amount: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BudgetWithSpent(BudgetResponse):
    spent_amount: float

    @property
    def remaining(self) -> float:
        return self.total_amount - self.spent_amount

    @property
    def percent_used(self) -> float:
        if self.total_amount <= 0:
            return 0.0
        return (self.spent_amount / self.total_amount) * 100


class BudgetArchiveResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    total_amount: float
    spent_amount: float
    archived_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
