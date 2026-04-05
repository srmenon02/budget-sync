from datetime import date
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Select, asc, desc, func, select

from ..models.account import Account
from ..models.transaction import Transaction
from ..schemas.transaction import TransactionBulkCreate, TransactionCreate, TransactionUpdate
from .loans import reduce_loan_balance


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
        loan_id=payload.loan_id,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    
    # If this is a loan payment, reduce the loan balance
    if payload.loan_id and abs(payload.amount) > 0:
        await reduce_loan_balance(db, payload.loan_id, user_id, abs(payload.amount))
    
    return tx


async def create_transactions_bulk(
    db: AsyncSession,
    payload: TransactionBulkCreate,
    user_id: str,
) -> list[Transaction]:
    account = await db.scalar(
        select(Account).where(
            Account.id == payload.account_id,
            Account.user_id == user_id,
        )
    )
    if account is None:
        raise PermissionError("You do not have access to this account")

    created: list[Transaction] = []
    for item in payload.items:
        normalized_amount = abs(item.amount)
        signed_amount = normalized_amount if item.tx_type == "income" else -normalized_amount
        tx = Transaction(
            account_id=payload.account_id,
            external_id=None,
            amount=signed_amount,
            description=item.description,
            merchant_name=item.merchant_name,
            category=item.category,
            user_category=item.category,
            date=item.date,
            notes=item.notes,
            is_manual=True,
        )
        db.add(tx)
        created.append(tx)

    await db.commit()
    for tx in created:
        await db.refresh(tx)
    return created


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


async def get_transaction_for_user(
    db: AsyncSession,
    user_id: str,
    transaction_id: str,
) -> Transaction | None:
    query: Select[tuple[Transaction]] = (
        select(Transaction)
        .join(Account, Account.id == Transaction.account_id)
        .where(
            Transaction.id == transaction_id,
            Account.user_id == user_id,
        )
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def update_transaction(
    db: AsyncSession,
    user_id: str,
    transaction_id: str,
    payload: TransactionUpdate,
) -> Transaction | None:
    tx = await get_transaction_for_user(db, user_id=user_id, transaction_id=transaction_id)
    if tx is None:
        return None

    if payload.amount is not None:
        tx.amount = payload.amount
    if payload.description is not None:
        tx.description = payload.description
    if payload.merchant_name is not None:
        tx.merchant_name = payload.merchant_name
    if payload.category is not None:
        tx.category = payload.category
        tx.user_category = payload.category
    if payload.date is not None:
        tx.date = payload.date
    if payload.notes is not None:
        tx.notes = payload.notes
    if payload.loan_id is not None:
        tx.loan_id = payload.loan_id

    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


async def delete_transaction(
    db: AsyncSession,
    user_id: str,
    transaction_id: str,
) -> bool:
    tx = await get_transaction_for_user(db, user_id=user_id, transaction_id=transaction_id)
    if tx is None:
        return False

    await db.delete(tx)
    await db.commit()
    return True


async def reset_transactions(
    db: AsyncSession,
    user_id: str,
    month: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    category: str | None = None,
    account_id: str | None = None,
    tx_type: str | None = None,
) -> int:
    query: Select[tuple[Transaction]] = (
        select(Transaction)
        .join(Account, Account.id == Transaction.account_id)
        .where(Account.user_id == user_id)
    )

    if month:
        start = date.fromisoformat(f"{month}-01")
        end = date(start.year + 1, 1, 1) if start.month == 12 else date(start.year, start.month + 1, 1)
        query = query.where(Transaction.date >= start, Transaction.date < end)

    if start_date is not None:
        query = query.where(Transaction.date >= start_date)
    if end_date is not None:
        query = query.where(Transaction.date <= end_date)
    if category:
        query = query.where(func.lower(func.coalesce(Transaction.user_category, Transaction.category)) == category.lower())
    if account_id:
        query = query.where(Transaction.account_id == account_id)
    if tx_type == "income":
        query = query.where(Transaction.amount > 0)
    if tx_type == "expense":
        query = query.where(Transaction.amount < 0)

    result = await db.execute(query)
    rows = result.scalars().all()
    for row in rows:
        await db.delete(row)
    await db.commit()
    return len(rows)
