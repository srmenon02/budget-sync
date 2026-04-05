from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import CurrentUser, get_current_user, get_db
from ..schemas.loan import LoanCreate, LoanPaymentCreate, LoanPaymentRead, LoanRead, LoanUpdate
from ..services.loans import (
    create_loan,
    delete_loan,
    get_loan,
    get_loan_payments,
    get_loans,
    record_payment,
    update_loan,
)

router = APIRouter()


@router.post("/", response_model=LoanRead)
async def api_create_loan(
    payload: LoanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new loan"""
    loan = await create_loan(
        db,
        user_id=current_user["user_id"],
        name=payload.name,
        principal_amount=payload.principal_amount,
        current_balance=payload.current_balance,
        interest_rate=payload.interest_rate,
        start_date=payload.start_date.isoformat() if payload.start_date else None,
    )
    return loan


@router.get("/", response_model=list[LoanRead])
async def api_get_loans(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get all loans for the current user"""
    loans = await get_loans(db, user_id=current_user["user_id"])
    return loans


@router.get("/{loan_id}", response_model=LoanRead)
async def api_get_loan(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get a single loan"""
    loan = await get_loan(db, user_id=current_user["user_id"], loan_id=loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


@router.put("/{loan_id}", response_model=LoanRead)
async def api_update_loan(
    loan_id: str,
    payload: LoanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a loan"""
    loan = await update_loan(
        db,
        user_id=current_user["user_id"],
        loan_id=loan_id,
        name=payload.name,
        current_balance=payload.current_balance,
        interest_rate=payload.interest_rate,
        start_date=payload.start_date.isoformat() if payload.start_date else None,
    )
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


@router.delete("/{loan_id}", status_code=204)
async def api_delete_loan(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a loan"""
    deleted = await delete_loan(db, user_id=current_user["user_id"], loan_id=loan_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Loan not found")


@router.post("/{loan_id}/payments", response_model=LoanPaymentRead)
async def api_record_payment(
    loan_id: str,
    payload: LoanPaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Record a payment for a loan"""
    loan = await get_loan(db, user_id=current_user["user_id"], loan_id=loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    payment = await record_payment(
        db,
        loan_id=loan_id,
        user_id=current_user["user_id"],
        amount=payload.amount,
        payment_date=payload.payment_date.isoformat(),
    )
    return payment


@router.get("/{loan_id}/payments", response_model=list[LoanPaymentRead])
async def api_get_payments(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get payment history for a loan"""
    loan = await get_loan(db, user_id=current_user["user_id"], loan_id=loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    payments = await get_loan_payments(db, loan_id=loan_id, user_id=current_user["user_id"])
    return payments
