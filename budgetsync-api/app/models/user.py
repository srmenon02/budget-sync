from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.sql import func

from ..database import Base


class User(Base):
    __tablename__ = "users"

    # id mirrors the Supabase auth user UUID (sub claim in JWT)
    id = Column(String(36), primary_key=True)
    email = Column(String(255), nullable=False, unique=True)
    display_name = Column(String(255), nullable=True)
    primary_payday_day = Column(Integer, nullable=False, default=1)
    secondary_payday_day = Column(Integer, nullable=False, default=15)
    paycheck_frequency = Column(String(20), nullable=False, default="monthly")  # weekly, bi-weekly, monthly
    is_active = Column(Boolean, default=True)
    created_at = Column(String(50), server_default=func.now())
