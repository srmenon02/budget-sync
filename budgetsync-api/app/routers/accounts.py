import logging

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import CurrentUser, get_current_user, get_db
from ..schemas.account import (
    AccountCreate,
    AccountRead,
    AccountsSummaryResponse,
    AccountUpdate,
    TellerConnectPayload,
)
from ..services.accounts import (
    connect_teller_account,
    create_account,
    delete_account,
    get_accounts_summary,
    list_accounts,
    update_account,
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
    accounts, total_balance, total_assets, total_liabilities, net_worth = (
        await get_accounts_summary(
            db,
            user_id=current_user["user_id"],
        )
    )
    return {
        "accounts": [
            {
                "id": account.id,
                "user_id": account.user_id,
                "name": account.name,
                "type": account.type,
                "provider": account.provider,
                "balance_current": (
                    float(account.balance_current)
                    if account.balance_current is not None
                    else None
                ),
                "currency": account.currency,
                "account_class": account.account_class,
                "credit_limit": (
                    float(account.credit_limit)
                    if account.credit_limit is not None
                    else None
                ),
                "statement_due_day": account.statement_due_day,
                "minimum_due": (
                    float(account.minimum_due)
                    if account.minimum_due is not None
                    else None
                ),
                "apr": float(account.apr) if account.apr is not None else None,
                "utilization_percent": (
                    round(
                        abs(float(account.balance_current))
                        / float(account.credit_limit)
                        * 100,
                        1,
                    )
                    if account.account_class == "liability"
                    and account.balance_current is not None
                    and account.credit_limit is not None
                    and float(account.credit_limit) > 0
                    else None
                ),
                "last_synced_at": account.last_synced_at,
                "institution_name": account.institution_name,
            }
            for account in accounts
        ],
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "net_worth": net_worth,
        "total_balance": total_balance,
    }


@router.post("/connect-teller", response_model=AccountRead)
async def api_connect_teller_account(
    payload: TellerConnectPayload,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        return await connect_teller_account(
            db, payload, user_id=current_user["user_id"]
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logging.exception("connect-teller failed: %s", exc)
        raise HTTPException(
            status_code=500, detail=f"Failed to connect Teller account: {exc}"
        ) from exc


@router.delete("/{account_id}", status_code=204)
async def api_delete_account(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        await delete_account(db, account_id=account_id, user_id=current_user["user_id"])
    except PermissionError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to delete account") from exc


@router.patch("/{account_id}", response_model=AccountRead)
async def api_update_account(
    account_id: str,
    payload: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        return await update_account(
            db,
            account_id=account_id,
            payload=payload,
            user_id=current_user["user_id"],
        )
    except PermissionError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to update account") from exc
