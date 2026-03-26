import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr


class PartnershipInvite(BaseModel):
    email: EmailStr


class PartnershipResponse(BaseModel):
    id: uuid.UUID
    requester_id: uuid.UUID
    partner_id: uuid.UUID | None
    invite_email: str
    status: str
    created_at: datetime
    accepted_at: datetime | None

    model_config = {"from_attributes": True}