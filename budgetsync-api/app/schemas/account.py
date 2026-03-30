from pydantic import BaseModel
from typing import Optional


class AccountCreate(BaseModel):
    provider: Optional[str] = None
    external_id: Optional[str] = None
    name: str
    type: Optional[str] = None
    balance_current: Optional[float] = None
    currency: Optional[str] = "USD"


class AccountRead(AccountCreate):
    id: str
    user_id: str

    model_config = {"from_attributes": True}
