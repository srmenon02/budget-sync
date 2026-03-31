from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.account import Account
from ..models.transaction import Transaction
from ..schemas.transaction import TransactionCreate


async def create_transaction(
    db: AsyncSession, payload: TransactionCreate, user_id: str
) -> Transaction:
    if not payload.account_id:
        raise ValueError("account_id is required for transaction creation")

    account = await db.scalar(
        select(Account).where(
            Account.id == payload.account_id,
            Account.user_id == user_id,
        )
    )
    if account is None:
        raise PermissionError("You do not have access to this account")

    tx = Transaction(
        account_id=payload.account_id,
        external_id=payload.external_id,
        amount=payload.amount,
        description=payload.description,
        merchant_name=payload.merchant_name,
        category=payload.category,
        user_category=payload.category,
        date=payload.date,
        notes=payload.notes,
        is_manual=payload.is_manual,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


async def list_transactions(
    db: AsyncSession, user_id: str, limit: int = 100
) -> List[Transaction]:
    q = await db.execute(
        select(Transaction)
        .join(Account, Account.id == Transaction.account_id)
        .where(Account.user_id == user_id)
        .order_by(Transaction.date.desc())
        .limit(limit)
    )
    return q.scalars().all()
