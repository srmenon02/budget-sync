import json
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget, BudgetArchive
from app.models.transaction import Transaction
from app.schemas.budget import BudgetCreate, BudgetResponse, BudgetWithSpent


async def get_active_budget(user_id: uuid.UUID, db: AsyncSession) -> Budget | None:
    """Fetch the currently active budget for a user."""
    query = select(Budget).where(
        Budget.owner_id == user_id,
        Budget.is_active.is_(True),
    )
    result = await db.execute(query)
    return result.scalars().first()


async def create_budget(
    user_id: uuid.UUID, payload: BudgetCreate, db: AsyncSession
) -> BudgetResponse:
    """Create a new budget. Sets as inactive if a budget already exists."""
    # Check if user has an active budget
    active = await get_active_budget(user_id, db)

    budget = Budget(
        id=uuid.uuid4(),
        owner_id=user_id,
        name=payload.name,
        total_amount=payload.total_amount,
        is_active=active is None,  # Only set as active if no active budget exists
    )
    db.add(budget)
    await db.commit()
    await db.refresh(budget)

    # Convert Decimal to float for JSON serialization
    return BudgetResponse(
        id=budget.id,
        owner_id=budget.owner_id,
        name=budget.name,
        total_amount=float(budget.total_amount),
        is_active=budget.is_active,
        created_at=budget.created_at,
        updated_at=budget.updated_at,
    )


async def get_budget_with_spent(
    budget_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession
) -> BudgetWithSpent | None:
    """Get a budget with calculated spent amount."""
    query = select(Budget).where(Budget.id == budget_id, Budget.owner_id == user_id)
    result = await db.execute(query)
    budget = result.scalars().first()

    if not budget:
        return None

    # Calculate spent amount for this budget
    tx_query = select(Transaction).where(Transaction.budget_id == budget_id)
    tx_result = await db.execute(tx_query)
    transactions = tx_result.scalars().all()

    spent_amount = sum(abs(tx.amount) for tx in transactions if tx.amount < 0)

    return BudgetWithSpent(
        id=budget.id,
        owner_id=budget.owner_id,
        name=budget.name,
        total_amount=float(budget.total_amount),
        is_active=budget.is_active,
        created_at=budget.created_at,
        updated_at=budget.updated_at,
        spent_amount=spent_amount,
    )


async def reset_budget(
    user_id: uuid.UUID, db: AsyncSession, archive: bool = True
) -> BudgetResponse | None:
    """Reset active budget: archive if requested and create a new one."""
    current_budget = await get_active_budget(user_id, db)

    if not current_budget:
        raise ValueError("No active budget to reset")

    # Archive current budget if requested
    if archive:
        # Get all transactions for this budget
        tx_query = select(Transaction).where(Transaction.budget_id == current_budget.id)
        tx_result = await db.execute(tx_query)
        transactions = tx_result.scalars().all()

        # Calculate spent amount
        spent_amount = sum(abs(tx.amount) for tx in transactions if tx.amount < 0)

        # Serialize transactions to JSON
        transactions_data = json.dumps(
            [
                {
                    "id": str(tx.id),
                    "merchant_name": tx.merchant_name,
                    "amount": float(tx.amount),
                    "transaction_date": tx.transaction_date.isoformat(),
                    "category": tx.category,
                }
                for tx in transactions
            ]
        )

        archive_entry = BudgetArchive(
            id=uuid.uuid4(),
            owner_id=user_id,
            budget_id=current_budget.id,
            name=current_budget.name,
            total_amount=float(current_budget.total_amount),
            spent_amount=spent_amount,
            transactions_data=transactions_data,
            archived_at=datetime.utcnow(),
        )
        db.add(archive_entry)

    # Mark current budget as inactive
    current_budget.is_active = False

    # Create a new active budget with the same name and amount
    new_budget = Budget(
        id=uuid.uuid4(),
        owner_id=user_id,
        name=current_budget.name,
        total_amount=current_budget.total_amount,
        is_active=True,
    )
    db.add(new_budget)

    await db.commit()
    await db.refresh(new_budget)

    return BudgetResponse(
        id=new_budget.id,
        owner_id=new_budget.owner_id,
        name=new_budget.name,
        total_amount=float(new_budget.total_amount),
        is_active=new_budget.is_active,
        created_at=new_budget.created_at,
        updated_at=new_budget.updated_at,
    )


async def export_budget(
    budget_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession
) -> dict:
    """Export a budget and its transactions as JSON data for download."""
    query = select(Budget).where(Budget.id == budget_id, Budget.owner_id == user_id)
    result = await db.execute(query)
    budget = result.scalars().first()

    if not budget:
        raise ValueError("Budget not found")

    # Get all transactions for this budget
    tx_query = select(Transaction).where(Transaction.budget_id == budget_id)
    tx_result = await db.execute(tx_query)
    transactions = tx_result.scalars().all()

    spent_amount = sum(abs(tx.amount) for tx in transactions if tx.amount < 0)

    export_data = {
        "budget": {
            "id": str(budget.id),
            "name": budget.name,
            "total_amount": float(budget.total_amount),
            "spent_amount": spent_amount,
            "remaining_amount": float(budget.total_amount) - spent_amount,
            "created_at": budget.created_at.isoformat(),
            "exported_at": datetime.utcnow().isoformat(),
        },
        "transactions": [
            {
                "id": str(tx.id),
                "merchant_name": tx.merchant_name,
                "amount": float(tx.amount),
                "transaction_date": tx.transaction_date.isoformat(),
                "category": tx.category,
                "description": tx.description,
            }
            for tx in transactions
        ],
    }

    return export_data


async def list_budget_archives(
    user_id: uuid.UUID, db: AsyncSession
) -> list[BudgetArchive]:
    """List all archived budgets for a user."""
    query = (
        select(BudgetArchive)
        .where(BudgetArchive.owner_id == user_id)
        .order_by(BudgetArchive.archived_at.desc())
    )
    result = await db.execute(query)
    return result.scalars().all()
