from datetime import date
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Select, asc, desc, func, select

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
    db: AsyncSession,
    user_id: str,
    limit: int = 100,
    page: int = 1,
    month: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    category: str | None = None,
    account_id: str | None = None,
    tx_type: str | None = None,
    search: str | None = None,
    sort: str = "date",
    sort_dir: str = "desc",
) -> tuple[List[Transaction], int]:
    base_query: Select[tuple[Transaction]] = (
        select(Transaction)
        .join(Account, Account.id == Transaction.account_id)
        .where(Account.user_id == user_id)
    )

    if month:
        start = date.fromisoformat(f"{month}-01")
        end = date(start.year + 1, 1, 1) if start.month == 12 else date(start.year, start.month + 1, 1)
        base_query = base_query.where(Transaction.date >= start, Transaction.date < end)

    if start_date is not None:
        base_query = base_query.where(Transaction.date >= start_date)
    if end_date is not None:
        base_query = base_query.where(Transaction.date <= end_date)
    if category:
        base_query = base_query.where(func.lower(func.coalesce(Transaction.user_category, Transaction.category)) == category.lower())
    if account_id:
        base_query = base_query.where(Transaction.account_id == account_id)
    if tx_type == "income":
        base_query = base_query.where(Transaction.amount > 0)
    if tx_type == "expense":
        base_query = base_query.where(Transaction.amount < 0)
    if search:
        pattern = f"%{search.strip()}%"
        base_query = base_query.where(
            func.lower(func.coalesce(Transaction.description, "")).like(func.lower(pattern))
            | func.lower(func.coalesce(Transaction.merchant_name, "")).like(func.lower(pattern))
        )

    sort_columns = {
        "date": Transaction.date,
        "amount": Transaction.amount,
        "category": func.coalesce(Transaction.user_category, Transaction.category),
    }
    sort_column = sort_columns.get(sort, Transaction.date)
    order_expression = asc(sort_column) if sort_dir == "asc" else desc(sort_column)

    count_query = select(func.count()).select_from(base_query.subquery())
    total_count = int(await db.scalar(count_query) or 0)

    offset = (page - 1) * limit
    query = base_query.order_by(order_expression).offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all(), total_count
