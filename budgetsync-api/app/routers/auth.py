from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import get_db
from ..schemas.auth import AuthResponse, LoginRequest, RegisterRequest, RegisterResponse
from ..services import auth as auth_service

router = APIRouter()


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    payload: RegisterRequest, db: AsyncSession = Depends(get_db)
) -> RegisterResponse:
    return await auth_service.register(payload, db)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest) -> AuthResponse:
    return await auth_service.login(payload)
