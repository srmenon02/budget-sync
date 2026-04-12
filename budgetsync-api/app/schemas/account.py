from typing import Literal, Optional

from pydantic import BaseModel

AccountClass = Literal["asset", "liability"]


class AccountCreate(BaseModel):
    provider: Optional[str] = None
    external_id: Optional[str] = None
    name: str
    type: Optional[str] = None
    balance_current: Optional[float] = None
    currency: Optional[str] = "USD"
    account_class: Optional[AccountClass] = None
    credit_limit: Optional[float] = None
    statement_due_day: Optional[int] = None
    minimum_due: Optional[float] = None
    apr: Optional[float] = None


class AccountUpdate(BaseModel):
    provider: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    balance_current: Optional[float] = None
    currency: Optional[str] = None
    account_class: Optional[AccountClass] = None
    credit_limit: Optional[float] = None
    statement_due_day: Optional[int] = None
    minimum_due: Optional[float] = None
    apr: Optional[float] = None


class AccountRead(AccountCreate):
    id: str
    user_id: str

    model_config = {"from_attributes": True}


class TellerConnectPayload(BaseModel):
    enrollment_id: str
    access_token: str
    institution_name: Optional[str] = None
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    account_type: Optional[str] = None
    last_four: Optional[str] = None


class AccountSummaryItem(BaseModel):
    id: str
    user_id: str
    name: str
    type: Optional[str] = None
    provider: Optional[str] = None
    balance_current: Optional[float] = None
    currency: Optional[str] = None
    account_class: AccountClass
    credit_limit: Optional[float] = None
    statement_due_day: Optional[int] = None
    minimum_due: Optional[float] = None
    apr: Optional[float] = None
    utilization_percent: Optional[float] = None
    last_synced_at: Optional[str] = None


class AccountsSummaryResponse(BaseModel):
    accounts: list[AccountSummaryItem]
    total_assets: float
    total_liabilities: float
    net_worth: float
    total_balance: float
