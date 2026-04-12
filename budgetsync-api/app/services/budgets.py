from calendar import monthrange
from datetime import date
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.account import Account
from ..models.budget import Budget
from ..models.transaction import Transaction


def _month_range(month: str) -> tuple[date, date]:
    start = date.fromisoformat(f"{month}-01")
    end = (
        date(start.year + 1, 1, 1)
        if start.month == 12
        else date(start.year, start.month + 1, 1)
    )
    return start, end


def _clamp_day(year: int, month: int, day: int) -> int:
    return max(1, min(day, monthrange(year, month)[1]))


def _add_month(year: int, month: int, delta: int) -> tuple[int, int]:
    absolute_month = (year * 12 + (month - 1)) + delta
    next_year = absolute_month // 12
    next_month = absolute_month % 12 + 1
    return next_year, next_month


def resolve_budget_window(
    month: str,
    period: str,
    primary_payday_day: int = 1,
    secondary_payday_day: int = 15,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> tuple[date, date]:
    if start_date is not None and end_date is not None:
        return start_date, end_date

    if period != "paycheck":
        return _month_range(month)

    reference = date.today()
    payday_days = sorted({primary_payday_day, secondary_payday_day})

    current_paydays = [
        date(
            reference.year,
            reference.month,
            _clamp_day(reference.year, reference.month, payday_day),
        )
        for payday_day in payday_days
    ]

    previous_year, previous_month = _add_month(reference.year, reference.month, -1)
    next_year, next_month = _add_month(reference.year, reference.month, 1)

    previous_paydays = [
        date(
            previous_year,
            previous_month,
            _clamp_day(previous_year, previous_month, payday_day),
        )
        for payday_day in payday_days
    ]
    next_paydays = [
        date(next_year, next_month, _clamp_day(next_year, next_month, payday_day))
        for payday_day in payday_days
    ]

    schedule = sorted(previous_paydays + current_paydays + next_paydays)
    current_index = 0
    for index, payday in enumerate(schedule):
        if payday <= reference:
            current_index = index
        else:
            break

    range_start = schedule[current_index]
    range_end = schedule[current_index + 1]
    return range_start, range_end


async def upsert_budget(
    db: AsyncSession,
    user_id: str,
    category: str,
    amount: float,
    month: str,
    period: str,
) -> Budget:
    year = month.split("-")[0]
    existing = await db.scalar(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.category == category,
            Budget.month == month,
            Budget.period == period,
        )
    )

    if existing is None:
        existing = Budget(
            user_id=user_id,
            category=category,
            amount=amount,
            month=month,
            year=year,
            period=period,
        )
        db.add(existing)
    else:
        existing.amount = amount

    await db.commit()
    await db.refresh(existing)
    return existing


async def bulk_upsert_budgets(
    db: AsyncSession,
    user_id: str,
    month: str,
    period: str,
    items: list[tuple[str, float]],
) -> list[Budget]:
    year = month.split("-")[0]
    touched: list[Budget] = []

    for category, amount in items:
        existing = await db.scalar(
            select(Budget).where(
                Budget.user_id == user_id,
                Budget.category == category,
                Budget.month == month,
                Budget.period == period,
            )
        )

        if existing is None:
            existing = Budget(
                user_id=user_id,
                category=category,
                amount=amount,
                month=month,
                year=year,
                period=period,
            )
            db.add(existing)
        else:
            existing.amount = amount

        touched.append(existing)

    await db.commit()
    for budget in touched:
        await db.refresh(budget)
    return touched


async def reset_budget_period(
    db: AsyncSession,
    user_id: str,
    month: str,
    period: str,
) -> int:
    budgets_result = await db.execute(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.month == month,
            Budget.period == period,
        )
    )
    budgets = budgets_result.scalars().all()

    for budget in budgets:
        await db.delete(budget)

    await db.commit()
    return len(budgets)


async def get_budgets_with_actuals(
    db: AsyncSession,
    user_id: str,
    month: str,
    period: str = "monthly",
    primary_payday_day: int = 1,
    secondary_payday_day: int = 15,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> tuple[list[dict[str, object]], date, date]:
    actuals_start, actuals_end = resolve_budget_window(
        month=month,
        period=period,
        primary_payday_day=primary_payday_day,
        secondary_payday_day=secondary_payday_day,
        start_date=start_date,
        end_date=end_date,
    )

    budgets_result = await db.execute(
        select(Budget)
        .where(
            Budget.user_id == user_id, Budget.month == month, Budget.period == period
        )
        .order_by(Budget.category.asc())
    )
    budgets = budgets_result.scalars().all()

    actuals_result = await db.execute(
        select(
            func.coalesce(Transaction.user_category, Transaction.category).label(
                "category"
            ),
            func.sum(func.abs(Transaction.amount)).label("spent"),
        )
        .select_from(Transaction)
        .join(Account, Account.id == Transaction.account_id)
        .where(
            Account.user_id == user_id,
            Transaction.amount < 0,
            (Transaction.tx_type.is_(None)) | (Transaction.tx_type != "transfer"),
            Transaction.date >= actuals_start,
            Transaction.date < actuals_end,
        )
        .group_by(func.coalesce(Transaction.user_category, Transaction.category))
    )

    spent_by_category: dict[str, float] = {}
    for category, spent in actuals_result.all():
        if category:
            spent_by_category[str(category)] = float(spent or 0.0)

    response: list[dict[str, object]] = []
    for budget in budgets:
        spent = spent_by_category.get(budget.category, 0.0)
        limit = float(budget.amount)
        remaining = limit - spent
        response.append(
            {
                "category": budget.category,
                "limit": limit,
                "spent": spent,
                "remaining": remaining,
                "over_budget": spent > limit,
                "period": budget.period,
            }
        )
    return response, actuals_start, actuals_end
