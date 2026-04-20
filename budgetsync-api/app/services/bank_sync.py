import base64
import binascii
import os
import tempfile
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
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
        self.app_id = os.getenv("TELLER_APP_ID", "") or os.getenv(
            "TELLER_APPLICATION_ID", ""
        )
        self.environment = _resolve_teller_environment()

    async def create_connect_token(self, user_id: str) -> dict[str, object]:
        return {
            "provider": "teller",
            "application_id": self.app_id,
            "environment": self.environment,
            "user_id": user_id,
            "is_configured": bool(self.app_id),
            "is_stub": False,
        }

    async def sync_user_accounts(
        self, db: AsyncSession, user_id: str
    ) -> dict[str, object]:
        result = await sync_teller_accounts_for_user(db, user_id)
        result["provider"] = "teller"
        return result


def _resolve_teller_environment() -> str:
    """Resolve Teller environment with safe defaults for local development.

    Non-production defaults to sandbox to avoid accidental live logins and
    billing requirements. To intentionally test live connections in non-prod,
    set TELLER_ALLOW_PRODUCTION_IN_DEV=true.
    """
    configured_env = os.getenv("TELLER_ENVIRONMENT", "").strip().lower()
    app_env = os.getenv("ENVIRONMENT", "development").strip().lower()

    if app_env == "production":
        return configured_env or "production"

    allow_live_in_dev = (
        os.getenv("TELLER_ALLOW_PRODUCTION_IN_DEV", "false").lower() == "true"
    )
    if configured_env in {"production", "live"} and not allow_live_in_dev:
        return "sandbox"

    return configured_env or "sandbox"


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
            raise ValueError(
                "Missing TELLER_TOKEN_ENCRYPTION_KEY for encrypted Teller token"
            )
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


def _decode_b64_secret(value: str, name: str) -> bytes:
    try:
        return base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError(f"{name} must be valid base64") from exc


def _write_secret_temp_file(data: bytes, suffix: str) -> str:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    path = tmp.name
    try:
        tmp.write(data)
        tmp.flush()
    finally:
        tmp.close()
    os.chmod(path, 0o600)
    return path


@contextmanager
def _teller_tls_client_options() -> Any:
    cert_b64 = os.getenv("TELLER_CLIENT_CERT_B64", "").strip()
    key_b64 = os.getenv("TELLER_CLIENT_KEY_B64", "").strip()
    ca_b64 = os.getenv("TELLER_CA_CERT_B64", "").strip()

    if not cert_b64 and not key_b64 and not ca_b64:
        yield {"verify": True}
        return

    if bool(cert_b64) != bool(key_b64):
        raise ValueError(
            "TELLER_CLIENT_CERT_B64 and TELLER_CLIENT_KEY_B64 must both be set"
        )

    temp_paths: list[str] = []
    options: dict[str, Any] = {"verify": True}

    try:
        if cert_b64 and key_b64:
            cert_path = _write_secret_temp_file(
                _decode_b64_secret(cert_b64, "TELLER_CLIENT_CERT_B64"), ".crt"
            )
            key_path = _write_secret_temp_file(
                _decode_b64_secret(key_b64, "TELLER_CLIENT_KEY_B64"), ".key"
            )
            temp_paths.extend([cert_path, key_path])
            options["cert"] = (cert_path, key_path)

        if ca_b64:
            ca_path = _write_secret_temp_file(
                _decode_b64_secret(ca_b64, "TELLER_CA_CERT_B64"), ".pem"
            )
            temp_paths.append(ca_path)
            options["verify"] = ca_path

        yield options
    finally:
        for path in temp_paths:
            try:
                Path(path).unlink(missing_ok=True)
            except OSError:
                continue


async def fetch_teller_accounts(access_token: str) -> list[dict[str, Any]]:
    with _teller_tls_client_options() as tls_options:
        async with httpx.AsyncClient(timeout=20.0, **tls_options) as client:
            response = await client.get(
                f"{_teller_base_url()}/accounts", headers=_auth_headers(access_token)
            )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, list):
        return []
    return [row for row in data if isinstance(row, dict)]


async def fetch_teller_transactions(
    access_token: str, external_account_id: str
) -> list[dict[str, Any]]:
    with _teller_tls_client_options() as tls_options:
        async with httpx.AsyncClient(timeout=20.0, **tls_options) as client:
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
    account_type = str(raw_account.get("type") or "").lower()
    is_liability = account_type in {"credit", "credit_card", "card", "charge", "loan"}

    if is_liability:
        nested = raw_account.get("balance")
        if isinstance(nested, dict):
            for key in ("ledger", "current", "balance", "available"):
                value = nested.get(key)
                if isinstance(value, (int, float)):
                    return float(value)
        for key in ("ledger", "current", "balance", "available"):
            value = raw_account.get(key)
            if isinstance(value, (int, float)):
                return float(value)
        return None

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


def _is_liability_account(account_type: str | None) -> bool:
    if not account_type:
        return False
    return account_type.strip().lower() in {
        "credit",
        "credit_card",
        "card",
        "charge",
        "loan",
    }


def _extract_credit_limit(raw_account: dict[str, Any]) -> float | None:
    for key in ("credit_limit", "limit"):
        value = raw_account.get(key)
        if isinstance(value, (int, float)):
            return float(value)

    nested = raw_account.get("balance")
    if isinstance(nested, dict):
        for key in ("limit", "credit_limit"):
            value = nested.get(key)
            if isinstance(value, (int, float)):
                return float(value)

    return None


def _coerce_date(value: Any) -> date:
    if isinstance(value, str) and value:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            pass
    return datetime.now(timezone.utc).date()


async def sync_teller_accounts_for_user(
    db: AsyncSession, user_id: str
) -> dict[str, object]:
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
            account_type = str(remote.get("type") or "checking")
            account_class = (
                "liability" if _is_liability_account(account_type) else "asset"
            )
            credit_limit = _extract_credit_limit(remote)

            local = by_external_id.get(external_id)
            if local is None:
                local = Account(
                    user_id=user_id,
                    provider="teller",
                    external_id=external_id,
                    name=str(remote.get("name") or "Connected Account"),
                    type=account_type,
                    balance_current=_extract_balance(remote),
                    currency="USD",
                    account_class=account_class,
                    credit_limit=credit_limit,
                    teller_access_token_enc=encrypt_teller_access_token(token),
                )
                db.add(local)
                by_external_id[external_id] = local
            else:
                local.name = str(remote.get("name") or local.name)
                local.type = account_type or local.type or "checking"
                local.balance_current = _extract_balance(remote)
                local.account_class = account_class
                local.credit_limit = credit_limit
                local.teller_access_token_enc = encrypt_teller_access_token(token)

            accounts_processed += 1

        await db.flush()

        for local in by_external_id.values():
            if not local.external_id:
                continue

            try:
                remote_transactions = await fetch_teller_transactions(
                    token, str(local.external_id)
                )
            except Exception as exc:
                errors.append(f"{local.id} tx sync failed: {str(exc)}")
                continue

            for remote_tx in remote_transactions:
                external_tx_id = str(remote_tx.get("id") or "")
                if not external_tx_id:
                    continue

                details = remote_tx.get("details")
                processing_status = (
                    details.get("processing_status")
                    if isinstance(details, dict)
                    else None
                )
                merchant_name = (
                    details.get("counterparty", {}).get("name")
                    if isinstance(details, dict)
                    and isinstance(details.get("counterparty"), dict)
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
                    tx_type=(
                        "income"
                        if _coerce_amount(remote_tx.get("amount")) > 0
                        else "expense"
                    ),
                    date=_coerce_date(remote_tx.get("date")),
                    notes=None,
                    is_manual=False,
                )
                db.add(tx)
                transactions_imported += 1

            local.last_synced_at = datetime.now(timezone.utc).isoformat()

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
            "ran_at": datetime.now(timezone.utc).isoformat(),
            "users_processed": len(user_ids),
            "accounts_processed": total_accounts,
            "transactions_imported": total_transactions,
            "errors": all_errors,
        }
