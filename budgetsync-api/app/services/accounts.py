from typing import Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.account import Account
from ..services.bank_sync import (
    encrypt_teller_access_token,
    fetch_teller_accounts,
    sync_teller_accounts_for_user,
)
from ..schemas.account import AccountCreate, TellerConnectPayload


async def create_account(db: AsyncSession, payload: AccountCreate, user_id: str) -> Account:
    acc = Account(
        user_id=user_id,
        provider=payload.provider,
        external_id=payload.external_id,
        name=payload.name,
        type=payload.type,
        balance_current=payload.balance_current,
        currency=payload.currency,
    )
    db.add(acc)
    await db.commit()
    await db.refresh(acc)
    return acc


async def list_accounts(db: AsyncSession, user_id: str, limit: int = 100) -> List[Account]:
    q = await db.execute(
        select(Account)
        .where(Account.user_id == user_id)
        .order_by(Account.name.asc())
        .limit(limit)
    )
    return q.scalars().all()


def _extract_balance(account: dict[str, Any]) -> float | None:
    balance_data = account.get("balance")
    if isinstance(balance_data, dict):
        for key in ("ledger", "available", "current"):
            value = balance_data.get(key)
            if isinstance(value, (int, float)):
                return float(value)

    for key in ("ledger", "available", "current", "balance"):
        value = account.get(key)
        if isinstance(value, (int, float)):
            return float(value)

    return None


async def connect_teller_account(
    db: AsyncSession, payload: TellerConnectPayload, user_id: str
) -> Account:
    teller_accounts = await fetch_teller_accounts(payload.access_token)
    if not teller_accounts:
        fallback = {
            "id": payload.account_id or payload.enrollment_id,
            "name": payload.account_name or payload.institution_name or "Connected Account",
            "type": payload.account_type or "checking",
            "balance": None,
        }
        teller_accounts = [fallback]

    primary_account: Account | None = None
    encrypted_token = encrypt_teller_access_token(payload.access_token)

    for raw in teller_accounts:
        external_id = str(raw.get("id") or payload.account_id or payload.enrollment_id)
        name = str(raw.get("name") or payload.account_name or payload.institution_name or "Connected Account")
        account_type = str(raw.get("type") or payload.account_type or "checking")
        balance_current = _extract_balance(raw)

        existing = await db.scalar(
            select(Account).where(
                Account.user_id == user_id,
                Account.provider == "teller",
                Account.external_id == external_id,
            )
        )

        if existing is None:
            existing = Account(
                user_id=user_id,
                provider="teller",
                external_id=external_id,
                name=name,
                type=account_type,
                balance_current=balance_current,
                currency="USD",
                teller_access_token_enc=encrypted_token,
            )
            db.add(existing)
        else:
            existing.name = name
            existing.type = account_type
            existing.balance_current = balance_current
            existing.teller_access_token_enc = encrypted_token

        if primary_account is None:
            primary_account = existing

    await db.commit()
    if primary_account is None:
        raise ValueError("No Teller accounts available to connect")
    await db.refresh(primary_account)

    await sync_teller_accounts_for_user(db, user_id)
    return primary_account
