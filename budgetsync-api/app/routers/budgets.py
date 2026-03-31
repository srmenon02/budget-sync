from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import CurrentUser, get_current_user, get_db
from ..schemas.budget import BudgetCurrentResponse, BudgetRead, BudgetUpsert
from ..services.budgets import get_budgets_with_actuals, upsert_budget

router = APIRouter()


@router.post("/", response_model=BudgetRead)
async def api_upsert_budget(
    payload: BudgetUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    budget = await upsert_budget(
        db,
        user_id=current_user["user_id"],
        category=payload.category,
        amount=payload.amount,
        month=payload.month,
    )
    return budget


@router.get("/current", response_model=BudgetCurrentResponse)
async def api_get_current_budgets(
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    budgets = await get_budgets_with_actuals(db, user_id=current_user["user_id"], month=month)
    return {"month": month, "budgets": budgets}
