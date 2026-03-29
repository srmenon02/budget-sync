from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.account import Account
from ..schemas.account import AccountCreate


async def create_account(db: AsyncSession, payload: AccountCreate, user_id: str) -> Account:
    acc = Account(
        user_id=user_id,
        provider=payload.provider,
        external_id=payload.external_id,
        name=payload.name,
        type=payload.type,
        balance_current=payload.balance_current,
        currency=payload.currency,
    )
    db.add(acc)
    await db.commit()
    await db.refresh(acc)
    return acc


async def list_accounts(db: AsyncSession, user_id: str, limit: int = 100) -> List[Account]:
    q = await db.execute(
        select(Account)
        .where(Account.user_id == user_id)
        .order_by(Account.name.asc())
        .limit(limit)
    )
    return q.scalars().all()
