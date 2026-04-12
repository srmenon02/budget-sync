import logging
import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.exceptions import ForbiddenError, GoalNotFoundError
from app.models.account import FinancialAccount
from app.models.goal import Goal
from app.models.user import User
from app.schemas.goal import (GoalCreate, GoalResponse, GoalUpdate,
                              GoalWithProgress)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/goals", tags=["goals"])


def _estimate_completion(
    current: float, target: float, target_date: date | None
) -> date | None:
    if target_date or current >= target:
        return target_date
    return None


@router.get("/", response_model=list[GoalWithProgress])
async def list_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GoalWithProgress]:
    result = await db.execute(select(Goal).where(Goal.owner_id == current_user.id))
    goals = result.scalars().all()

    enriched: list[GoalWithProgress] = []
    for g in goals:
        current_balance = 0.0
        if g.linked_account_id:
            acc_result = await db.execute(
                select(FinancialAccount).where(
                    FinancialAccount.id == g.linked_account_id
                )
            )
            acc = acc_result.scalar_one_or_none()
            if acc and acc.current_balance:
                current_balance = float(acc.current_balance)

        target = float(g.target_amount)
        progress = round((current_balance / target * 100) if target > 0 else 0.0, 1)

        enriched.append(
            GoalWithProgress(
                id=g.id,
                owner_id=g.owner_id,
                name=g.name,
                target_amount=target,
                target_date=g.target_date,
                linked_account_id=g.linked_account_id,
                created_at=g.created_at,
                current_balance=current_balance,
                progress_percent=min(progress, 100.0),
                estimated_completion_date=_estimate_completion(
                    current_balance, target, g.target_date
                ),
            )
        )
    return enriched


@router.post("/", response_model=GoalResponse, status_code=201)
async def create_goal(
    payload: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Goal:
    goal = Goal(
        owner_id=current_user.id,
        name=payload.name,
        target_amount=payload.target_amount,
        target_date=payload.target_date,
        linked_account_id=payload.linked_account_id,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


@router.patch("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: uuid.UUID,
    payload: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Goal:
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise GoalNotFoundError()
    if goal.owner_id != current_user.id:
        raise ForbiddenError()

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)

    await db.commit()
    await db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=204)
async def delete_goal(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise GoalNotFoundError()
    if goal.owner_id != current_user.id:
        raise ForbiddenError()
    await db.delete(goal)
    await db.commit()
