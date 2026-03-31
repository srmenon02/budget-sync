import os
from typing import AsyncGenerator, TypedDict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from .database import AsyncSessionLocal


class CurrentUser(TypedDict):
    user_id: str


security = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> CurrentUser:
    """Resolve the authenticated Supabase user from a Bearer JWT.

    In local development, set DEV_AUTH_BYPASS=true to skip JWT verification.
    """
    env = os.getenv("ENVIRONMENT", "development").lower()
    # Never allow auth bypass in production. In non-production, bypass is opt-in.
    dev_bypass = env != "production" and os.getenv("DEV_AUTH_BYPASS", "false").lower() == "true"

    if credentials is None:
        if dev_bypass:
            return {"user_id": os.getenv("DEV_USER_ID", "dev-user")}
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    secret = os.getenv("SUPABASE_JWT_SECRET") or os.getenv("JWT_SECRET")
    if not secret:
        if dev_bypass:
            return {"user_id": os.getenv("DEV_USER_ID", "dev-user")}
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET is not configured",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )

    return {"user_id": str(user_id)}
