from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    supabase_jwt_secret: str
    supabase_url: str
    teller_app_id: str
    teller_api_key: str
    teller_environment: str = "sandbox"
    resend_api_key: str
    encryption_key: str
    frontend_url: str = "http://localhost:5173"
    secret_key: str

    class Config:
        env_file = str(Path(__file__).parent / ".env")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
