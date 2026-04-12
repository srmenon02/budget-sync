import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.exceptions import ForbiddenError
from app.models.user import User
from app.schemas.budget import (BudgetArchiveResponse, BudgetCreate,
                                BudgetResponse, BudgetUpdate,
                                BudgetWithSpent)
from app.services import budgets as budget_service

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("/active", response_model=BudgetWithSpent | None)
async def get_active_budget(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetWithSpent | None:
    """Get the currently active budget for the user."""
    budget = await budget_service.get_active_budget(current_user.id, db)
    if not budget:
        return None
    
    # Get budget with spent amount calculated
    return await budget_service.get_budget_with_spent(budget.id, current_user.id, db)


@router.post("/", response_model=BudgetResponse, status_code=201)
async def create_budget(
    payload: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetResponse:
    """Create a new budget."""
    logger.debug(f"Budget creation request: name={payload.name}, amount={payload.total_amount}, user={current_user.id}")
    try:
        result = await budget_service.create_budget(current_user.id, payload, db)
        logger.debug(f"Budget created successfully: {result.id}")
        return result
    except Exception as e:
        logger.error(f"Error creating budget: {str(e)}", exc_info=True)
        raise


@router.patch("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: uuid.UUID,
    payload: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetResponse:
    """Update a budget."""
    budget = await budget_service.get_active_budget(current_user.id, db)
    if not budget or budget.id != budget_id:
        raise HTTPException(status_code=404, detail="Budget not found")
    if budget.owner_id != current_user.id:
        raise ForbiddenError()

    if payload.name is not None:
        budget.name = payload.name
    if payload.total_amount is not None:
        budget.total_amount = payload.total_amount

    await db.commit()
    await db.refresh(budget)
    
    return BudgetResponse(
        id=budget.id,
        owner_id=budget.owner_id,
        name=budget.name,
        total_amount=float(budget.total_amount),
        is_active=budget.is_active,
        created_at=budget.created_at,
        updated_at=budget.updated_at,
    )


@router.post("/{budget_id}/reset", response_model=BudgetResponse)
async def reset_budget(
    budget_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    archive: bool = True,
) -> BudgetResponse:
    """Reset the active budget and optionally archive it."""
    budget = await budget_service.get_active_budget(current_user.id, db)
    if not budget or budget.id != budget_id:
        raise HTTPException(status_code=404, detail="Budget not found")
    if budget.owner_id != current_user.id:
        raise ForbiddenError()

    new_budget = await budget_service.reset_budget(current_user.id, db, archive=archive)
    return new_budget


@router.get("/{budget_id}/export", response_model=dict)
async def export_budget(
    budget_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Export a budget with all its transactions as JSON."""
    try:
        export_data = await budget_service.export_budget(budget_id, current_user.id, db)
        return JSONResponse(content=export_data, media_type="application/json")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/archives", response_model=list[BudgetArchiveResponse])
async def list_budget_archives(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BudgetArchiveResponse]:
    """List all archived budgets for the user."""
    archives = await budget_service.list_budget_archives(current_user.id, db)
    return [BudgetArchiveResponse.model_validate(a) for a in archives]
