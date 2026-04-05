from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import CurrentUser, get_current_user, get_db
from ..schemas.auth import AuthResponse, LoginRequest, RefreshRequest, RefreshResponse, RegisterRequest, RegisterResponse
from ..schemas.user import UserSettingsRead, UserSettingsUpdate
from ..services import auth as auth_service
from ..services.users import get_user_settings, update_user_settings

router = APIRouter()


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    payload: RegisterRequest, db: AsyncSession = Depends(get_db)
) -> RegisterResponse:
    return await auth_service.register(payload, db)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest) -> AuthResponse:
    return await auth_service.login(payload)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(payload: RefreshRequest) -> RefreshResponse:
    return await auth_service.refresh_session(payload)


@router.get("/me", response_model=UserSettingsRead)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> UserSettingsRead:
    return await get_user_settings(
        db,
        user_id=current_user["user_id"],
        email=current_user.get("email"),
    )


@router.patch("/me", response_model=UserSettingsRead)
async def patch_me(
    payload: UserSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> UserSettingsRead:
    return await update_user_settings(
        db,
        user_id=current_user["user_id"],
        payload=payload,
        email=current_user.get("email"),
    )
