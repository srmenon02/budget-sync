from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import CurrentUser, get_current_user, get_db
from ..schemas.transaction import TransactionBulkCreate, TransactionCreate, TransactionListResponse, TransactionRead, TransactionUpdate
from ..services.transactions import (
    create_transaction,
    create_transactions_bulk,
    delete_transaction,
    list_transactions,
    reset_transactions,
    update_transaction,
)

router = APIRouter()


@router.post("/", response_model=TransactionRead)
async def api_create_transaction(
    payload: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        tx = await create_transaction(db, payload, user_id=current_user["user_id"])
        return tx
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to create transaction",
        ) from exc


@router.post("/bulk", response_model=list[TransactionRead])
async def api_create_transactions_bulk(
    payload: TransactionBulkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        rows = await create_transactions_bulk(db, payload, user_id=current_user["user_id"])
        return [TransactionRead.model_validate(tx) for tx in rows]
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to import transactions",
        ) from exc


@router.get("/", response_model=TransactionListResponse)
async def api_list_transactions(
    limit: int = Query(default=100, ge=1, le=500),
    page: int = Query(default=1, ge=1),
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    category: str | None = Query(default=None),
    account_id: str | None = Query(default=None),
    tx_type: Literal["income", "expense", "transfer"] | None = Query(default=None, alias="type"),
    search: str | None = Query(default=None),
    sort: Literal["date", "amount", "category"] = Query(default="date"),
    sort_dir: Literal["asc", "desc"] = Query(default="desc"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    transactions, total_count = await list_transactions(
        db,
        user_id=current_user["user_id"],
        limit=limit,
        page=page,
        month=month,
        start_date=start_date,
        end_date=end_date,
        category=category,
        account_id=account_id,
        tx_type=tx_type,
        search=search,
        sort=sort,
        sort_dir=sort_dir,
    )
    return {
        "transactions": [TransactionRead.model_validate(tx) for tx in transactions],
        "total_count": total_count,
        "page": page,
        "limit": limit,
    }


@router.delete("/current", status_code=204)
async def api_reset_transactions(
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    category: str | None = Query(default=None),
    account_id: str | None = Query(default=None),
    tx_type: Literal["income", "expense", "transfer"] | None = Query(default=None, alias="type"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await reset_transactions(
        db,
        user_id=current_user["user_id"],
        month=month,
        start_date=start_date,
        end_date=end_date,
        category=category,
        account_id=account_id,
        tx_type=tx_type,
    )


@router.patch("/{transaction_id}", response_model=TransactionRead)
async def api_update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    tx = await update_transaction(
        db,
        user_id=current_user["user_id"],
        transaction_id=transaction_id,
        payload=payload,
    )
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@router.delete("/{transaction_id}", status_code=204)
async def api_delete_transaction(
    transaction_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    deleted = await delete_transaction(
        db,
        user_id=current_user["user_id"],
        transaction_id=transaction_id,
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")
