import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    display_name: str | None = None


class UserCreate(UserBase):
    supabase_id: str


class UserUpdate(BaseModel):
    display_name: str | None = None


class UserResponse(UserBase):
    id: uuid.UUID
    supabase_id: str
    created_at: datetime

    model_config = {"from_attributes": True}