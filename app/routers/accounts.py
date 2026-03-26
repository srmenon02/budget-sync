import logging
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.account import FinancialAccount
from app.schemas.account import AccountCreate, AccountResponse, AccountUpdate, TellerEnrollment
from app.services.bank_sync.sync import sync_account
from app.utils.encryption import encrypt_token
from app.exceptions import AccountNotFoundError, ForbiddenError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("/", response_model=list[AccountResponse])
async def list_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[FinancialAccount]:
    result = await db.execute(
        select(FinancialAccount).where(FinancialAccount.owner_id == current_user.id)
    )
    return result.scalars().all()


@router.post("/connect-teller", response_model=AccountResponse, status_code=201)
async def connect_teller_account(
    payload: TellerEnrollment,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FinancialAccount:
    account = FinancialAccount(
        owner_id=current_user.id,
        teller_enrollment_id=payload.enrollment_id,
        teller_account_id=payload.account_id,
        encrypted_access_token=encrypt_token(payload.access_token),
        institution_name=payload.institution_name,
        account_name=payload.account_name,
        account_type=payload.account_type,
        last_four=payload.last_four,
        is_manual=False,
        sync_status="pending",
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    try:
        await sync_account(db, account)
        await db.refresh(account)
    except Exception as e:
        logger.error("Initial sync failed for account %s: %s", account.id, e)

    return account


@router.post("/manual", response_model=AccountResponse, status_code=201)
async def create_manual_account(
    payload: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FinancialAccount:
    account = FinancialAccount(
        owner_id=current_user.id,
        institution_name=payload.institution_name,
        account_name=payload.account_name,
        account_type=payload.account_type,
        last_four=payload.last_four,
        is_manual=True,
        sync_status="manual",
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: uuid.UUID,
    payload: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FinancialAccount:
    result = await db.execute(select(FinancialAccount).where(FinancialAccount.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise AccountNotFoundError()
    if account.owner_id != current_user.id:
        raise ForbiddenError()

    if payload.is_shared_with_partner is not None:
        account.is_shared_with_partner = payload.is_shared_with_partner
    if payload.account_name is not None:
        account.account_name = payload.account_name

    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(FinancialAccount).where(FinancialAccount.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise AccountNotFoundError()
    if account.owner_id != current_user.id:
        raise ForbiddenError()
    await db.delete(account)
    await db.commit()


@router.post("/{account_id}/sync", response_model=AccountResponse)
async def trigger_sync(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FinancialAccount:
    result = await db.execute(select(FinancialAccount).where(FinancialAccount.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise AccountNotFoundError()
    if account.owner_id != current_user.id:
        raise ForbiddenError()
    await sync_account(db, account)
    await db.refresh(account)
    return account