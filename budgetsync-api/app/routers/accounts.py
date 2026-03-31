from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import CurrentUser, get_current_user, get_db
from ..schemas.account import AccountCreate, AccountRead
from ..services.accounts import create_account, list_accounts

router = APIRouter()


@router.post("/", response_model=AccountRead)
async def api_create_account(
    payload: AccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        acc = await create_account(db, payload, user_id=current_user["user_id"])
        return acc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to create account",
        ) from exc


@router.get("/", response_model=List[AccountRead])
async def api_list_accounts(
    limit: int = Query(default=100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return await list_accounts(db, user_id=current_user["user_id"], limit=limit)
