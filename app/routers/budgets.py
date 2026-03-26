import logging
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.budget import Budget
from app.models.transaction import Transaction
from app.models.account import FinancialAccount
from app.schemas.budget import BudgetCreate, BudgetResponse, BudgetUpdate, BudgetWithActual
from app.exceptions import BudgetNotFoundError, ForbiddenError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("/", response_model=list[BudgetWithActual])
async def list_budgets(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BudgetWithActual]:
    budgets_result = await db.execute(
        select(Budget).where(
            Budget.owner_id == current_user.id,
            Budget.month == month,
            Budget.year == year,
        )
    )
    budgets = budgets_result.scalars().all()

    account_ids_result = await db.execute(
        select(FinancialAccount.id).where(FinancialAccount.owner_id == current_user.id)
    )
    account_ids = [row[0] for row in account_ids_result.fetchall()]

    spending_result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount).label("total"))
        .where(
            Transaction.account_id.in_(account_ids),
            extract("month", Transaction.transaction_date) == month,
            extract("year", Transaction.transaction_date) == year,
            Transaction.amount < 0,
        )
        .group_by(Transaction.category)
    )
    spending_by_category = {row.category: abs(float(row.total)) for row in spending_result.fetchall()}

    enriched: list[BudgetWithActual] = []
    for b in budgets:
        actual = spending_by_category.get(b.category, 0.0)
        budget_amount = float(b.amount)
        enriched.append(
            BudgetWithActual(
                id=b.id,
                owner_id=b.owner_id,
                category=b.category,
                amount=budget_amount,
                month=b.month,
                year=b.year,
                created_at=b.created_at,
                actual_spent=actual,
                remaining=budget_amount - actual,
                percent_used=round((actual / budget_amount * 100) if budget_amount > 0 else 0.0, 1),
            )
        )
    return enriched


@router.post("/", response_model=BudgetResponse, status_code=201)
async def create_budget(
    payload: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Budget:
    budget = Budget(
        owner_id=current_user.id,
        category=payload.category,
        amount=payload.amount,
        month=payload.month,
        year=payload.year,
    )
    db.add(budget)
    await db.commit()
    await db.refresh(budget)
    return budget


@router.patch("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: uuid.UUID,
    payload: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Budget:
    result = await db.execute(select(Budget).where(Budget.id == budget_id))
    budget = result.scalar_one_or_none()
    if not budget:
        raise BudgetNotFoundError()
    if budget.owner_id != current_user.id:
        raise ForbiddenError()
    if payload.amount is not None:
        budget.amount = payload.amount
    await db.commit()
    await db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=204)
async def delete_budget(
    budget_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Budget).where(Budget.id == budget_id))
    budget = result.scalar_one_or_none()
    if not budget:
        raise BudgetNotFoundError()
    if budget.owner_id != current_user.id:
        raise ForbiddenError()
    await db.delete(budget)
    await db.commit()