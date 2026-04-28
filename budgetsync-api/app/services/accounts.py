from typing import Any, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.account import Account
from ..schemas.account import AccountCreate, AccountUpdate, TellerConnectPayload
from ..services.bank_sync import (
    encrypt_teller_access_token,
    fetch_teller_accounts,
    sync_teller_accounts_for_user,
)


def _is_credit_type(account_type: str | None) -> bool:
    if not account_type:
        return False
    normalized = account_type.strip().lower()
    return normalized in {"credit", "credit_card", "card", "charge"}


def _infer_account_class(
    account_type: str | None, explicit_class: str | None = None
) -> str:
    if explicit_class in {"asset", "liability"}:
        return explicit_class
    return "liability" if _is_credit_type(account_type) else "asset"


async def create_account(
    db: AsyncSession, payload: AccountCreate, user_id: str
) -> Account:
    account_class = _infer_account_class(payload.type, payload.account_class)
    acc = Account(
        user_id=user_id,
        provider=payload.provider,
        external_id=payload.external_id,
        name=payload.name,
        type=payload.type,
        balance_current=payload.balance_current,
        currency=payload.currency,
        account_class=account_class,
        credit_limit=payload.credit_limit,
        statement_due_day=payload.statement_due_day,
        minimum_due=payload.minimum_due,
        apr=payload.apr,
    )
    db.add(acc)
    await db.commit()
    await db.refresh(acc)
    return acc


async def list_accounts(
    db: AsyncSession, user_id: str, limit: int = 100
) -> List[Account]:
    q = await db.execute(
        select(Account)
        .where(Account.user_id == user_id)
        .order_by(Account.name.asc())
        .limit(limit)
    )
    return q.scalars().all()


async def delete_account(db: AsyncSession, account_id: str, user_id: str) -> None:
    account = await db.scalar(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    if account is None:
        raise PermissionError("Account not found or access denied")
    await db.delete(account)
    await db.commit()


async def update_account(
    db: AsyncSession, account_id: str, payload: AccountUpdate, user_id: str
) -> Account:
    account = await db.scalar(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    if account is None:
        raise PermissionError("Account not found or access denied")

    updates = payload.model_dump(exclude_unset=True)

    if "name" in updates:
        account.name = updates["name"]
    if "provider" in updates:
        account.provider = updates["provider"]
    if "type" in updates:
        account.type = updates["type"]
    if "balance_current" in updates:
        account.balance_current = updates["balance_current"]
    if "currency" in updates:
        account.currency = updates["currency"]

    if "type" in updates or "account_class" in updates:
        account.account_class = _infer_account_class(
            updates.get("type", account.type), updates.get("account_class")
        )

    if "credit_limit" in updates:
        account.credit_limit = updates["credit_limit"]
    if "statement_due_day" in updates:
        account.statement_due_day = updates["statement_due_day"]
    if "minimum_due" in updates:
        account.minimum_due = updates["minimum_due"]
    if "apr" in updates:
        account.apr = updates["apr"]

    if account.account_class != "liability":
        account.credit_limit = None
        account.statement_due_day = None
        account.minimum_due = None
        account.apr = None

    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def get_accounts_summary(
    db: AsyncSession, user_id: str
) -> tuple[list[Account], float, float, float, float]:
    accounts = await list_accounts(db, user_id=user_id, limit=200)
    total_assets = 0.0
    total_liabilities = 0.0
    for account in accounts:
        if account.balance_current is None:
            continue
        balance = float(account.balance_current)
        if account.account_class == "liability":
            total_liabilities += abs(balance)
        else:
            total_assets += balance

    net_worth = total_assets - total_liabilities
    total_balance = net_worth
    return accounts, total_balance, total_assets, total_liabilities, net_worth


def _extract_balance(account: dict[str, Any]) -> float | None:
    balance_data = account.get("balance")
    if isinstance(balance_data, dict):
        for key in ("ledger", "available", "current"):
            value = balance_data.get(key)
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, str):
                try:
                    return float(value)
                except (ValueError, TypeError):
                    pass

    for key in ("ledger", "available", "current", "balance"):
        value = account.get(key)
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except (ValueError, TypeError):
                pass

    return None


async def connect_teller_account(
    db: AsyncSession, payload: TellerConnectPayload, user_id: str
) -> Account:
    teller_accounts = await fetch_teller_accounts(payload.access_token)
    if not teller_accounts:
        fallback = {
            "id": payload.account_id or payload.enrollment_id,
            "name": payload.account_name
            or payload.institution_name
            or "Connected Account",
            "type": payload.account_type or "checking",
            "balance": None,
        }
        teller_accounts = [fallback]

    primary_account: Account | None = None
    encrypted_token = encrypt_teller_access_token(payload.access_token)

    for raw in teller_accounts:
        external_id = str(raw.get("id") or payload.account_id or payload.enrollment_id)
        name = str(
            raw.get("name")
            or payload.account_name
            or payload.institution_name
            or "Connected Account"
        )
        account_type = str(raw.get("type") or payload.account_type or "checking")
        balance_current = _extract_balance(raw)
        account_class = _infer_account_class(account_type)
        raw_credit_limit = raw.get("credit_limit") or raw.get("limit")
        credit_limit = (
            float(raw_credit_limit)
            if isinstance(raw_credit_limit, (int, float))
            else None
        )
        institution_name = (
            str(raw.get("institution", {}).get("name"))
            if isinstance(raw.get("institution"), dict) and raw["institution"].get("name")
            else payload.institution_name or None
        )

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
                institution_name=institution_name,
                balance_current=balance_current,
                currency="USD",
                teller_access_token_enc=encrypted_token,
                account_class=account_class,
                credit_limit=credit_limit,
            )
            db.add(existing)
        else:
            existing.name = name
            existing.type = account_type
            existing.institution_name = institution_name
            existing.balance_current = balance_current
            existing.teller_access_token_enc = encrypted_token
            existing.account_class = account_class
            existing.credit_limit = credit_limit

        if primary_account is None:
            primary_account = existing

    await db.commit()
    if primary_account is None:
        raise ValueError("No Teller accounts available to connect")
    await db.refresh(primary_account)

    await sync_teller_accounts_for_user(db, user_id)
    return primary_account
