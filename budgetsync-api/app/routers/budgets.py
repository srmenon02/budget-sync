from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import CurrentUser, get_current_user, get_db
from ..schemas.budget import BudgetBulkUpsert, BudgetCurrentResponse, BudgetRead, BudgetUpsert
from ..services.budgets import bulk_upsert_budgets, get_budgets_with_actuals, reset_budget_period, upsert_budget
from ..services.users import get_user_settings

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
        period=payload.period,
    )
    return budget


@router.post("/bulk", response_model=list[BudgetRead])
async def api_bulk_upsert_budgets(
    payload: BudgetBulkUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    items = [(item.category, item.amount) for item in payload.items]
    budgets = await bulk_upsert_budgets(
        db,
        user_id=current_user["user_id"],
        month=payload.month,
        period=payload.period,
        items=items,
    )
    return budgets


@router.get("/current", response_model=BudgetCurrentResponse)
async def api_get_current_budgets(
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    period: Literal["monthly", "paycheck"] = Query(default="monthly"),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    settings = await get_user_settings(
        db,
        user_id=current_user["user_id"],
        email=current_user.get("email"),
    )
    budgets, range_start, range_end = await get_budgets_with_actuals(
        db,
        user_id=current_user["user_id"],
        month=month,
        period=period,
        primary_payday_day=settings.primary_payday_day,
        secondary_payday_day=settings.secondary_payday_day,
        start_date=start_date,
        end_date=end_date,
    )
    return {
        "month": month,
        "period": period,
        "range_start": range_start,
        "range_end": range_end,
        "budgets": budgets,
    }


@router.delete("/current", status_code=204)
async def api_reset_current_budgets(
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    period: Literal["monthly", "paycheck"] = Query(default="paycheck"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await reset_budget_period(
        db,
        user_id=current_user["user_id"],
        month=month,
        period=period,
    )
