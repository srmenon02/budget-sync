from datetime import datetime
from decimal import Decimal

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.loan import Loan, LoanPayment


async def create_loan(
    db: AsyncSession,
    user_id: str,
    name: str,
    principal_amount: float,
    current_balance: float,
    interest_rate: float,
    start_date: str | None = None,
) -> Loan:
    """Create a new loan"""
    loan = Loan(
        user_id=user_id,
        name=name,
        principal_amount=Decimal(str(principal_amount)),
        current_balance=Decimal(str(current_balance)),
        interest_rate=interest_rate,
        start_date=start_date,
    )
    db.add(loan)
    await db.commit()
    await db.refresh(loan)
    return loan


async def get_loan(db: AsyncSession, user_id: str, loan_id: str) -> Loan | None:
    """Get a single loan by ID"""
    query = select(Loan).where(and_(Loan.id == loan_id, Loan.user_id == user_id))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_loans(db: AsyncSession, user_id: str) -> list[Loan]:
    """Get all loans for a user"""
    query = select(Loan).where(Loan.user_id == user_id).order_by(Loan.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


async def update_loan(
    db: AsyncSession,
    user_id: str,
    loan_id: str,
    name: str | None = None,
    current_balance: float | None = None,
    interest_rate: float | None = None,
    start_date: str | None = None,
) -> Loan | None:
    """Update a loan"""
    loan = await get_loan(db, user_id, loan_id)
    if not loan:
        return None

    if name is not None:
        loan.name = name
    if current_balance is not None:
        loan.current_balance = Decimal(str(current_balance))
    if interest_rate is not None:
        loan.interest_rate = interest_rate
    if start_date is not None:
        loan.start_date = start_date

    loan.updated_at = datetime.now().isoformat()
    db.add(loan)
    await db.commit()
    await db.refresh(loan)
    return loan


async def delete_loan(db: AsyncSession, user_id: str, loan_id: str) -> bool:
    """Delete a loan (cascades to payments)"""
    loan = await get_loan(db, user_id, loan_id)
    if not loan:
        return False

    await db.delete(loan)
    await db.commit()
    return True


async def record_payment(
    db: AsyncSession,
    loan_id: str,
    user_id: str,
    amount: float,
    payment_date: str,
) -> LoanPayment:
    """Record a payment for a loan and reduce its balance"""
    # Get the loan
    loan = await get_loan(db, user_id, loan_id)
    if not loan:
        raise ValueError("Loan not found")

    # Deduct from current balance
    amount_decimal = Decimal(str(amount))
    new_balance = loan.current_balance - amount_decimal
    loan.current_balance = max(new_balance, Decimal("0"))  # Don't go negative
    loan.updated_at = datetime.now().isoformat()
    db.add(loan)

    # Record the payment
    payment = LoanPayment(
        loan_id=loan_id,
        user_id=user_id,
        amount=Decimal(str(amount)),
        payment_date=payment_date,
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return payment


async def get_loan_payments(db: AsyncSession, loan_id: str, user_id: str) -> list[LoanPayment]:
    """Get all payments for a loan"""
    query = select(LoanPayment).where(
        and_(LoanPayment.loan_id == loan_id, LoanPayment.user_id == user_id)
    ).order_by(LoanPayment.payment_date.desc())
    result = await db.execute(query)
    return result.scalars().all()


async def reduce_loan_balance(db: AsyncSession, loan_id: str, user_id: str, amount: float) -> Loan | None:
    """Reduce a loan's balance (called from transaction creation for loan payments)"""
    loan = await get_loan(db, user_id, loan_id)
    if not loan:
        return None

    amount_decimal = Decimal(str(amount))
    new_balance = loan.current_balance - amount_decimal
    loan.current_balance = max(new_balance, Decimal("0"))
    loan.updated_at = datetime.now().isoformat()
    db.add(loan)
    await db.commit()
    await db.refresh(loan)
    return loan
