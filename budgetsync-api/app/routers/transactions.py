from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import CurrentUser, get_current_user, get_db
from ..schemas.transaction import TransactionCreate, TransactionRead
from ..services.transactions import create_transaction, list_transactions

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


@router.get("/", response_model=List[TransactionRead])
async def api_list_transactions(
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return await list_transactions(db, user_id=current_user["user_id"], limit=limit)
