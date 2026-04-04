from datetime import date
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.account import Account
from ..models.budget import Budget
from ..models.transaction import Transaction


def _month_range(month: str) -> tuple[date, date]:
    start = date.fromisoformat(f"{month}-01")
    end = date(start.year + 1, 1, 1) if start.month == 12 else date(start.year, start.month + 1, 1)
    return start, end


async def upsert_budget(
    db: AsyncSession,
    user_id: str,
    category: str,
    amount: float,
    month: str,
) -> Budget:
    year = month.split("-")[0]
    existing = await db.scalar(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.category == category,
            Budget.month == month,
        )
    )

    if existing is None:
        existing = Budget(
            user_id=user_id,
            category=category,
            amount=amount,
            month=month,
            year=year,
        )
        db.add(existing)
    else:
        existing.amount = amount

    await db.commit()
    await db.refresh(existing)
    return existing


async def get_budgets_with_actuals(
    db: AsyncSession,
    user_id: str,
    month: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> list[dict[str, object]]:
    if start_date is not None and end_date is not None:
        actuals_start = start_date
        actuals_end = end_date
    else:
        actuals_start, actuals_end = _month_range(month)

    budgets_result = await db.execute(
        select(Budget).where(Budget.user_id == user_id, Budget.month == month).order_by(Budget.category.asc())
    )
    budgets = budgets_result.scalars().all()

    actuals_result = await db.execute(
        select(
            func.coalesce(Transaction.user_category, Transaction.category).label("category"),
            func.sum(func.abs(Transaction.amount)).label("spent"),
        )
        .select_from(Transaction)
        .join(Account, Account.id == Transaction.account_id)
        .where(
            Account.user_id == user_id,
            Transaction.amount < 0,
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
            }
        )
    return response
