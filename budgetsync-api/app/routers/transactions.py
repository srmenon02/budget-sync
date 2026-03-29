from fastapi import APIRouter, Depends, HTTPException
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
    _ = current_user
    try:
        tx = await create_transaction(db, payload)
        return tx
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[TransactionRead])
async def api_list_transactions(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    _ = current_user
    return await list_transactions(db, limit=limit)
