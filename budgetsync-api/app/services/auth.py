import logging
import os

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from supabase import AsyncClient, acreate_client as create_async_client

from ..models.user import User
from ..schemas.auth import AuthResponse, LoginRequest, RegisterRequest, RegisterResponse

logger = logging.getLogger(__name__)


def _get_supabase_url() -> str:
    url = os.getenv("SUPABASE_URL", "")
    if not url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL is not configured",
        )
    return url


def _get_supabase_anon_key() -> str:
    key = os.getenv("SUPABASE_ANON_KEY", "")
    if not key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_ANON_KEY is not configured",
        )
    return key


async def _client() -> AsyncClient:
    return await create_async_client(_get_supabase_url(), _get_supabase_anon_key())


async def register(
    payload: RegisterRequest, db: AsyncSession
) -> RegisterResponse:
    """Create a new Supabase auth user and mirror into local users table."""
    sb = await _client()
    try:
        response = await sb.auth.sign_up(
            {"email": payload.email, "password": payload.password}
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if response.user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed — check your email or password requirements",
        )

    user_id = str(response.user.id)
    email = response.user.email or payload.email

    # Upsert local user record (idempotent on re-registration)
    local_user = User(
        id=user_id,
        email=email,
        display_name=payload.display_name,
    )
    db.add(local_user)
    try:
        await db.commit()
    except Exception:
        await db.rollback()  # user may already exist; not fatal

    if response.session is None:
        return RegisterResponse(
            status="pending_verification",
            message="Account created. Check your email to confirm your account before signing in.",
            user_id=user_id,
            email=email,
            access_token=None,
        )

    return RegisterResponse(
        status="authenticated",
        message="Registration successful.",
        access_token=response.session.access_token,
        user_id=user_id,
        email=email,
    )


async def login(payload: LoginRequest) -> AuthResponse:
    """Sign in with email + password via Supabase and return the JWT."""
    logger.info(f"Login attempt for email: {payload.email}")
    sb = await _client()
    try:
        logger.info(f"Calling Supabase auth.sign_in_with_password for {payload.email}")
        response = await sb.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
        logger.info(f"Supabase returned: session={bool(response.session)}, user={bool(response.user)}")
        if response.session:
            logger.info(f"Session expires at: {response.session.expires_at}")
    except Exception as exc:
        logger.error(f"Supabase login failed: {type(exc).__name__}: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(exc)}",
        ) from exc

    if response.session is None or response.user is None:
        logger.error(f"Supabase login returned incomplete response: session={response.session}, user={response.user}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return AuthResponse(
        access_token=response.session.access_token,
        user_id=str(response.user.id),
        email=response.user.email or payload.email,
    )
