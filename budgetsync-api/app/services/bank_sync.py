import os
import base64
from datetime import UTC, date, datetime
from typing import Any

import httpx
from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import AsyncSessionLocal
from ..models.account import Account
from ..models.transaction import Transaction


class TellerSyncService:
    """Stubbed bank-sync facade for Teller integration during MVP scaffolding."""

    def __init__(self) -> None:
        self.app_id = os.getenv("TELLER_APP_ID", "") or os.getenv("TELLER_APPLICATION_ID", "")
        self.environment = os.getenv("TELLER_ENVIRONMENT", "sandbox")

    async def create_connect_token(self, user_id: str) -> dict[str, object]:
        return {
            "provider": "teller",
            "application_id": self.app_id,
            "environment": self.environment,
            "user_id": user_id,
            "is_configured": bool(self.app_id),
            "is_stub": False,
        }

    async def sync_user_accounts(self, db: AsyncSession, user_id: str) -> dict[str, object]:
        result = await sync_teller_accounts_for_user(db, user_id)
        result["provider"] = "teller"
        return result


def _build_fernet() -> Fernet | None:
    key = os.getenv("TELLER_TOKEN_ENCRYPTION_KEY")
    if not key:
        return None
    return Fernet(key.encode("utf-8"))


def encrypt_teller_access_token(access_token: str) -> str:
    fernet = _build_fernet()
    if fernet is None:
        return f"plain:{access_token}"
    encrypted = fernet.encrypt(access_token.encode("utf-8")).decode("utf-8")
    return f"enc:{encrypted}"


def decrypt_teller_access_token(stored_value: str | None) -> str | None:
    if not stored_value:
        return None

    if stored_value.startswith("enc:"):
        fernet = _build_fernet()
        if fernet is None:
            raise ValueError("Missing TELLER_TOKEN_ENCRYPTION_KEY for encrypted Teller token")
        token = stored_value.removeprefix("enc:")
        return fernet.decrypt(token.encode("utf-8")).decode("utf-8")

    if stored_value.startswith("plain:"):
        return stored_value.removeprefix("plain:")

    # Backward-compatible fallback for previously stored plain values.
    return stored_value


def _auth_headers(access_token: str) -> dict[str, str]:
    encoded = base64.b64encode(f"{access_token}:".encode("utf-8")).decode("utf-8")
    headers: dict[str, str] = {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/json",
    }
    app_id = os.getenv("TELLER_APP_ID") or os.getenv("TELLER_APPLICATION_ID")
    if app_id:
        headers["Teller-Application-ID"] = app_id
    return headers


def _teller_base_url() -> str:
    return os.getenv("TELLER_API_BASE_URL", "https://api.teller.io").rstrip("/")


async def fetch_teller_accounts(access_token: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(f"{_teller_base_url()}/accounts", headers=_auth_headers(access_token))
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, list):
        return []
    return [row for row in data if isinstance(row, dict)]


async def fetch_teller_transactions(access_token: str, external_account_id: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            f"{_teller_base_url()}/accounts/{external_account_id}/transactions",
            headers=_auth_headers(access_token),
            params={"count": 500},
        )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, list):
        return []
    return [row for row in data if isinstance(row, dict)]


def _extract_balance(raw_account: dict[str, Any]) -> float | None:
    for key in ("ledger", "available", "current", "balance"):
        value = raw_account.get(key)
        if isinstance(value, (int, float)):
            return float(value)
    nested = raw_account.get("balance")
    if isinstance(nested, dict):
        for key in ("ledger", "available", "current"):
            value = nested.get(key)
            if isinstance(value, (int, float)):
                return float(value)
    return None


def _coerce_amount(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        return float(value)
    return 0.0


def _coerce_date(value: Any) -> date:
    if isinstance(value, str) and value:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            pass
    return datetime.now(UTC).date()


async def sync_teller_accounts_for_user(db: AsyncSession, user_id: str) -> dict[str, object]:
    query = await db.execute(
        select(Account).where(Account.user_id == user_id, Account.provider == "teller")
    )
    existing_accounts = query.scalars().all()

    if not existing_accounts:
        return {
            "status": "ok",
            "user_id": user_id,
            "accounts_processed": 0,
            "transactions_imported": 0,
            "errors": [],
        }

    token_to_accounts: dict[str, list[Account]] = {}
    errors: list[str] = []

    for account in existing_accounts:
        try:
            token = decrypt_teller_access_token(account.teller_access_token_enc)
        except Exception as exc:
            errors.append(f"{account.id}: {str(exc)}")
            continue
        if not token:
            errors.append(f"{account.id}: missing Teller token")
            continue
        token_to_accounts.setdefault(token, []).append(account)

    transactions_imported = 0
    accounts_processed = 0

    for token, local_accounts in token_to_accounts.items():
        try:
            teller_accounts = await fetch_teller_accounts(token)
        except Exception as exc:
            errors.append(f"token sync failed: {str(exc)}")
            continue

        by_external_id: dict[str, Account] = {
            str(acc.external_id): acc for acc in local_accounts if acc.external_id
        }

        for remote in teller_accounts:
            external_id = str(remote.get("id", ""))
            if not external_id:
                continue

            local = by_external_id.get(external_id)
            if local is None:
                local = Account(
                    user_id=user_id,
                    provider="teller",
                    external_id=external_id,
                    name=str(remote.get("name") or "Connected Account"),
                    type=str(remote.get("type") or "checking"),
                    balance_current=_extract_balance(remote),
                    currency="USD",
                    teller_access_token_enc=encrypt_teller_access_token(token),
                )
                db.add(local)
                by_external_id[external_id] = local
            else:
                local.name = str(remote.get("name") or local.name)
                local.type = str(remote.get("type") or local.type or "checking")
                local.balance_current = _extract_balance(remote)
                local.teller_access_token_enc = encrypt_teller_access_token(token)

            accounts_processed += 1

        await db.flush()

        for local in by_external_id.values():
            if not local.external_id:
                continue

            try:
                remote_transactions = await fetch_teller_transactions(token, str(local.external_id))
            except Exception as exc:
                errors.append(f"{local.id} tx sync failed: {str(exc)}")
                continue

            for remote_tx in remote_transactions:
                external_tx_id = str(remote_tx.get("id") or "")
                if not external_tx_id:
                    continue

                details = remote_tx.get("details")
                processing_status = details.get("processing_status") if isinstance(details, dict) else None
                merchant_name = (
                    details.get("counterparty", {}).get("name")
                    if isinstance(details, dict) and isinstance(details.get("counterparty"), dict)
                    else None
                )

                existing_tx = await db.scalar(
                    select(Transaction).where(
                        Transaction.account_id == local.id,
                        Transaction.external_id == external_tx_id,
                    )
                )
                if existing_tx is not None:
                    continue

                tx = Transaction(
                    account_id=local.id,
                    external_id=external_tx_id,
                    amount=_coerce_amount(remote_tx.get("amount")),
                    description=remote_tx.get("description") or processing_status,
                    merchant_name=merchant_name,
                    category=None,
                    user_category=None,
                    date=_coerce_date(remote_tx.get("date")),
                    notes=None,
                    is_manual=False,
                )
                db.add(tx)
                transactions_imported += 1

            local.last_synced_at = datetime.now(UTC).isoformat()

    await db.commit()
    return {
        "status": "ok",
        "user_id": user_id,
        "accounts_processed": accounts_processed,
        "transactions_imported": transactions_imported,
        "errors": errors,
    }


async def run_periodic_sync() -> dict[str, object]:
    """Periodic Teller sync runner for all users with linked teller accounts."""
    async with AsyncSessionLocal() as session:
        users_query = await session.execute(
            select(Account.user_id).where(
                Account.provider == "teller",
                Account.teller_access_token_enc.is_not(None),
            )
        )
        user_ids = sorted({row[0] for row in users_query.all() if row[0]})

        total_accounts = 0
        total_transactions = 0
        all_errors: list[str] = []

        for user_id in user_ids:
            result = await sync_teller_accounts_for_user(session, str(user_id))
            total_accounts += int(result.get("accounts_processed", 0))
            total_transactions += int(result.get("transactions_imported", 0))
            all_errors.extend([str(err) for err in result.get("errors", [])])

        return {
            "status": "ok",
            "provider": "teller",
            "ran_at": datetime.now(UTC).isoformat(),
            "users_processed": len(user_ids),
            "accounts_processed": total_accounts,
            "transactions_imported": total_transactions,
            "errors": all_errors,
        }
