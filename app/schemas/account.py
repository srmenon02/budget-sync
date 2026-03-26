import uuid
from datetime import datetime
from pydantic import BaseModel


class AccountBase(BaseModel):
    institution_name: str
    account_name: str
    account_type: str
    last_four: str | None = None


class AccountCreate(AccountBase):
    is_manual: bool = False


class TellerEnrollment(BaseModel):
    enrollment_id: str
    access_token: str
    institution_name: str
    account_id: str
    account_name: str
    account_type: str
    last_four: str | None = None


class AccountUpdate(BaseModel):
    is_shared_with_partner: bool | None = None
    account_name: str | None = None


class AccountResponse(AccountBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    is_manual: bool
    is_shared_with_partner: bool
    sync_status: str
    current_balance: float | None
    last_synced_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}