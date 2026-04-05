from datetime import date

from pydantic import BaseModel, Field, model_validator


class LoanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    principal_amount: float = Field(gt=0)
    current_balance: float = Field(ge=0)
    interest_rate: float = Field(ge=0)
    start_date: date | None = None

    @model_validator(mode="after")
    def validate_balances(self) -> "LoanCreate":
        if self.current_balance > self.principal_amount:
            raise ValueError("Current balance cannot exceed principal amount")
        return self


class LoanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    current_balance: float | None = Field(default=None, ge=0)
    interest_rate: float | None = Field(default=None, ge=0)
    start_date: date | None = None


class LoanRead(BaseModel):
    id: str
    user_id: str
    name: str
    principal_amount: float
    current_balance: float
    interest_rate: float
    start_date: str | None  # YYYY-MM-DD
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}

    @property
    def progress_percentage(self) -> float:
        """Calculate progress as percentage of principal paid"""
        if self.principal_amount == 0:
            return 0.0
        paid = self.principal_amount - self.current_balance
        return (paid / self.principal_amount) * 100


class LoanPaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    payment_date: date


class LoanPaymentRead(BaseModel):
    id: str
    loan_id: str
    user_id: str
    amount: float
    payment_date: str  # YYYY-MM-DD
    created_at: str

    model_config = {"from_attributes": True}
