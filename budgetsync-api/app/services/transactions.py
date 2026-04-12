from datetime import date
from typing import List

from sqlalchemy import Select, asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.account import Account
from ..models.transaction import Transaction
from ..models.user import User
from ..schemas.transaction import (
    TransactionBulkCreate,
    TransactionCreate,
    TransactionUpdate,
)
from .loans import reduce_loan_balance
from .paycheck import calculate_paycheck_number


def _infer_tx_type(amount: float) -> str:
    return "income" if amount > 0 else "expense"


def _balance_delta_for_account(account: Account, amount: float) -> float:
    """Map transaction amount to account-balance delta based on account class."""
    normalized_amount = float(amount)
    if account.account_class == "liability":
        return -normalized_amount
    return normalized_amount


def _apply_balance_delta(account: Account, delta: float) -> None:
    current_balance = float(account.balance_current or 0)
    account.balance_current = current_balance + float(delta)


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

    # Get user for paycheck calculation if paycheck_number not provided
    paycheck_number = payload.paycheck_number
    if paycheck_number is None:
        user = await db.scalar(select(User).where(User.id == user_id))
        if user:
            paycheck_number = calculate_paycheck_number(
                payload.date,
                user.primary_payday_day,
                user.secondary_payday_day,
                user.paycheck_frequency,
            )

    tx = Transaction(
        account_id=payload.account_id,
        external_id=payload.external_id,
        amount=payload.amount,
        description=payload.description,
        merchant_name=payload.merchant_name,
        category=payload.category,
        user_category=payload.category,
        tx_type=payload.tx_type or _infer_tx_type(payload.amount),
        date=payload.date,
        notes=payload.notes,
        is_manual=payload.is_manual,
        loan_id=payload.loan_id,
        is_paid_off=payload.is_paid_off,
        paycheck_number=paycheck_number,
    )
    balance_delta = _balance_delta_for_account(account, float(payload.amount))
    _apply_balance_delta(account, balance_delta)
    db.add(tx)
    db.add(account)
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

    # Get user for paycheck calculation
    user = await db.scalar(select(User).where(User.id == user_id))

    created: list[Transaction] = []
    total_balance_delta = 0.0
    for item in payload.items:
        normalized_amount = abs(item.amount)
        signed_amount = (
            normalized_amount if item.tx_type == "income" else -normalized_amount
        )
        total_balance_delta += _balance_delta_for_account(account, signed_amount)

        # Calculate paycheck_number if not provided
        paycheck_number = item.paycheck_number
        if paycheck_number is None and user:
            paycheck_number = calculate_paycheck_number(
                item.date,
                user.primary_payday_day,
                user.secondary_payday_day,
                user.paycheck_frequency,
            )

        tx = Transaction(
            account_id=payload.account_id,
            external_id=None,
            amount=signed_amount,
            description=item.description,
            merchant_name=item.merchant_name,
            category=item.category,
            user_category=item.category,
            tx_type=item.tx_type,
            date=item.date,
            notes=item.notes,
            is_manual=True,
            paycheck_number=paycheck_number,
        )
        db.add(tx)
        created.append(tx)

    _apply_balance_delta(account, total_balance_delta)
    db.add(account)
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
    paycheck_number: int | None = None,
    paid_off_only: bool = False,
) -> tuple[List[Transaction], int]:
    base_query: Select[tuple[Transaction]] = (
        select(Transaction)
        .join(Account, Account.id == Transaction.account_id)
        .where(Account.user_id == user_id)
    )

    if month:
        start = date.fromisoformat(f"{month}-01")
        end = (
            date(start.year + 1, 1, 1)
            if start.month == 12
            else date(start.year, start.month + 1, 1)
        )
        base_query = base_query.where(Transaction.date >= start, Transaction.date < end)

    if start_date is not None:
        base_query = base_query.where(Transaction.date >= start_date)
    if end_date is not None:
        base_query = base_query.where(Transaction.date <= end_date)
    if category:
        base_query = base_query.where(
            func.lower(func.coalesce(Transaction.user_category, Transaction.category))
            == category.lower()
        )
    if account_id:
        base_query = base_query.where(Transaction.account_id == account_id)
    if paycheck_number is not None:
        base_query = base_query.where(Transaction.paycheck_number == paycheck_number)
    if paid_off_only:
        base_query = base_query.where(Transaction.is_paid_off == True)
    if tx_type == "income":
        base_query = base_query.where(
            (Transaction.tx_type == "income")
            | ((Transaction.tx_type.is_(None)) & (Transaction.amount > 0))
        )
    if tx_type == "expense":
        base_query = base_query.where(
            ((Transaction.tx_type == "expense") | (Transaction.tx_type.is_(None)))
            & (Transaction.amount < 0)
        )
    if tx_type == "transfer":
        base_query = base_query.where(Transaction.tx_type == "transfer")
    if search:
        pattern = f"%{search.strip()}%"
        base_query = base_query.where(
            func.lower(func.coalesce(Transaction.description, "")).like(
                func.lower(pattern)
            )
            | func.lower(func.coalesce(Transaction.merchant_name, "")).like(
                func.lower(pattern)
            )
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
    tx = await get_transaction_for_user(
        db, user_id=user_id, transaction_id=transaction_id
    )
    if tx is None:
        return None

    account = await db.scalar(
        select(Account).where(
            Account.id == tx.account_id,
            Account.user_id == user_id,
        )
    )
    if account is None:
        raise PermissionError("You do not have access to this account")

    previous_amount = float(tx.amount)

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
    if payload.tx_type is not None:
        tx.tx_type = payload.tx_type
    elif payload.amount is not None and tx.tx_type != "transfer":
        tx.tx_type = _infer_tx_type(float(tx.amount))
    if payload.is_paid_off is not None:
        tx.is_paid_off = payload.is_paid_off
    if payload.paycheck_number is not None:
        tx.paycheck_number = payload.paycheck_number

    new_amount = float(tx.amount)
    if payload.amount is not None and new_amount != previous_amount:
        delta = _balance_delta_for_account(
            account, new_amount
        ) - _balance_delta_for_account(account, previous_amount)
        _apply_balance_delta(account, delta)
        db.add(account)

    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


async def delete_transaction(
    db: AsyncSession,
    user_id: str,
    transaction_id: str,
) -> bool:
    tx = await get_transaction_for_user(
        db, user_id=user_id, transaction_id=transaction_id
    )
    if tx is None:
        return False

    account = await db.scalar(
        select(Account).where(
            Account.id == tx.account_id,
            Account.user_id == user_id,
        )
    )
    if account is None:
        raise PermissionError("You do not have access to this account")

    reverse_delta = -_balance_delta_for_account(account, float(tx.amount))
    _apply_balance_delta(account, reverse_delta)
    db.add(account)

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
        end = (
            date(start.year + 1, 1, 1)
            if start.month == 12
            else date(start.year, start.month + 1, 1)
        )
        query = query.where(Transaction.date >= start, Transaction.date < end)

    if start_date is not None:
        query = query.where(Transaction.date >= start_date)
    if end_date is not None:
        query = query.where(Transaction.date <= end_date)
    if category:
        query = query.where(
            func.lower(func.coalesce(Transaction.user_category, Transaction.category))
            == category.lower()
        )
    if account_id:
        query = query.where(Transaction.account_id == account_id)
    if tx_type == "income":
        query = query.where(
            (Transaction.tx_type == "income")
            | ((Transaction.tx_type.is_(None)) & (Transaction.amount > 0))
        )
    if tx_type == "expense":
        query = query.where(
            ((Transaction.tx_type == "expense") | (Transaction.tx_type.is_(None)))
            & (Transaction.amount < 0)
        )
    if tx_type == "transfer":
        query = query.where(Transaction.tx_type == "transfer")

    result = await db.execute(query)
    rows = result.scalars().all()

    if rows:
        account_ids = {row.account_id for row in rows if row.account_id}
        accounts_result = await db.execute(
            select(Account).where(
                Account.user_id == user_id,
                Account.id.in_(account_ids),
            )
        )
        accounts_by_id = {
            account.id: account for account in accounts_result.scalars().all()
        }

        for row in rows:
            if not row.account_id:
                continue
            account = accounts_by_id.get(row.account_id)
            if account is None:
                continue
            reverse_delta = -_balance_delta_for_account(account, float(row.amount))
            _apply_balance_delta(account, reverse_delta)
            db.add(account)

    for row in rows:
        await db.delete(row)
    await db.commit()
    return len(rows)
