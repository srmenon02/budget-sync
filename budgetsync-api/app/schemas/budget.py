from pydantic import BaseModel, Field


class BudgetUpsert(BaseModel):
    category: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    month: str = Field(pattern=r"^\d{4}-\d{2}$")


class BudgetRead(BaseModel):
    id: str
    user_id: str
    category: str
    amount: float
    month: str
    year: str

    model_config = {"from_attributes": True}


class BudgetActualRead(BaseModel):
    category: str
    limit: float
    spent: float
    remaining: float
    over_budget: bool


class BudgetCurrentResponse(BaseModel):
    month: str
    budgets: list[BudgetActualRead]
