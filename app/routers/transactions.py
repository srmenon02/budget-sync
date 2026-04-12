import logging
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.exceptions import (AccountNotFoundError, ForbiddenError,
                            TransactionNotFoundError)
from app.models.account import FinancialAccount
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import (TransactionCreate, TransactionResponse,
                                     TransactionUpdate)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/transactions", tags=["transactions"])


async def _assert_account_owner(
    account_id: uuid.UUID, user: User, db: AsyncSession
) -> FinancialAccount:
    result = await db.execute(
        select(FinancialAccount).where(FinancialAccount.id == account_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise AccountNotFoundError()
    if account.owner_id != user.id:
        raise ForbiddenError()
    return account


@router.get("/", response_model=list[TransactionResponse])
async def list_transactions(
    account_id: uuid.UUID | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2000),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Transaction]:
    user_account_ids_result = await db.execute(
        select(FinancialAccount.id).where(FinancialAccount.owner_id == current_user.id)
    )
    user_account_ids = {row[0] for row in user_account_ids_result.fetchall()}

    query = select(Transaction).where(Transaction.account_id.in_(user_account_ids))

    if account_id:
        if account_id not in user_account_ids:
            raise ForbiddenError()
        query = query.where(Transaction.account_id == account_id)

    if month and year:
        from sqlalchemy import extract

        query = query.where(
            extract("month", Transaction.transaction_date) == month,
            extract("year", Transaction.transaction_date) == year,
        )

    query = (
        query.order_by(Transaction.transaction_date.desc()).offset(offset).limit(limit)
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    payload: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Transaction:
    await _assert_account_owner(payload.account_id, current_user, db)

    tx = Transaction(
        account_id=payload.account_id,
        amount=payload.amount,
        merchant_name=payload.merchant_name,
        description=payload.description,
        category=payload.category,
        transaction_date=payload.transaction_date,
        is_manual=True,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


@router.patch("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: uuid.UUID,
    payload: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Transaction:
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise TransactionNotFoundError()

    await _assert_account_owner(tx.account_id, current_user, db)

    if payload.merchant_name is not None:
        tx.merchant_name = payload.merchant_name
    if payload.category is not None:
        tx.category = payload.category
    if payload.description is not None:
        tx.description = payload.description

    await db.commit()
    await db.refresh(tx)
    return tx


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise TransactionNotFoundError()
    await _assert_account_owner(tx.account_id, current_user, db)
    await db.delete(tx)
    await db.commit()
