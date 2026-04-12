import uuid
from datetime import date, datetime

from pydantic import BaseModel


class GoalBase(BaseModel):
    name: str
    target_amount: float
    target_date: date | None = None
    linked_account_id: uuid.UUID | None = None


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    name: str | None = None
    target_amount: float | None = None
    target_date: date | None = None
    linked_account_id: uuid.UUID | None = None


class GoalResponse(GoalBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class GoalWithProgress(GoalResponse):
    current_balance: float
    progress_percent: float
    estimated_completion_date: date | None
