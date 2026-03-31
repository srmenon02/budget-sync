from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import CurrentUser, get_current_user, get_db
from ..schemas.account import AccountCreate, AccountRead, AccountsSummaryResponse, TellerConnectPayload
from ..services.accounts import (
    connect_teller_account,
    create_account,
    get_accounts_summary,
    list_accounts,
)

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


@router.get("/summary", response_model=AccountsSummaryResponse)
async def api_accounts_summary(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    accounts, total_balance = await get_accounts_summary(db, user_id=current_user["user_id"])
    return {
        "accounts": [
            {
                "id": account.id,
                "name": account.name,
                "type": account.type,
                "provider": account.provider,
                "balance_current": float(account.balance_current) if account.balance_current is not None else None,
                "currency": account.currency,
                "last_synced_at": account.last_synced_at,
            }
            for account in accounts
        ],
        "total_balance": total_balance,
    }


@router.post("/connect-teller", response_model=AccountRead)
async def api_connect_teller_account(
    payload: TellerConnectPayload,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        return await connect_teller_account(db, payload, user_id=current_user["user_id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to connect Teller account") from exc
