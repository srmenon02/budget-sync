import logging
import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import FinancialAccount
from app.models.transaction import Transaction
from app.services.bank_sync.teller import TellerClient
from app.utils.encryption import decrypt_token

logger = logging.getLogger(__name__)


async def sync_account(db: AsyncSession, account: FinancialAccount) -> int:
    if not account.encrypted_access_token or not account.teller_account_id:
        logger.warning("Account %s has no Teller credentials, skipping", account.id)
        return 0

    access_token = decrypt_token(account.encrypted_access_token)
    client = TellerClient(access_token)

    since = (
        account.last_synced_at.date() - timedelta(days=1)
        if account.last_synced_at
        else date.today() - timedelta(days=180)
    )

    raw_transactions = await client.get_transactions(account.teller_account_id, since=since)
    balance_data = await client.get_account_balance(account.teller_account_id)

    existing_ids_result = await db.execute(
        select(Transaction.teller_transaction_id).where(
            Transaction.account_id == account.id,
            Transaction.teller_transaction_id.isnot(None),
        )
    )
    existing_ids = {row[0] for row in existing_ids_result.fetchall()}

    new_count = 0
    for raw in raw_transactions:
        teller_id = raw.get("id")
        if teller_id and teller_id in existing_ids:
            continue

        amount_raw = raw.get("amount", "0")
        try:
            amount = float(amount_raw)
        except (ValueError, TypeError):
            amount = 0.0

        tx_date_raw = raw.get("date", date.today().isoformat())
        try:
            tx_date = date.fromisoformat(tx_date_raw)
        except ValueError:
            tx_date = date.today()

        transaction = Transaction(
            id=uuid.uuid4(),
            account_id=account.id,
            teller_transaction_id=teller_id,
            amount=amount,
            merchant_name=raw.get("merchant", {}).get("name") if isinstance(raw.get("merchant"), dict) else None,
            description=raw.get("description"),
            category=raw.get("details", {}).get("category") if isinstance(raw.get("details"), dict) else None,
            transaction_date=tx_date,
            is_manual=False,
        )
        db.add(transaction)
        new_count += 1

    current_balance = balance_data.get("available") or balance_data.get("ledger")
    if current_balance is not None:
        try:
            account.current_balance = float(current_balance)
        except (ValueError, TypeError):
            pass

    account.last_synced_at = datetime.utcnow()
    account.sync_status = "ok"
    await db.commit()

    logger.info("Synced %d new transactions for account %s", new_count, account.id)
    return new_count


async def sync_all_accounts(db: AsyncSession) -> None:
    result = await db.execute(
        select(FinancialAccount).where(
            FinancialAccount.is_manual == False,
            FinancialAccount.encrypted_access_token.isnot(None),
        )
    )
    accounts = result.scalars().all()

    for account in accounts:
        try:
            await sync_account(db, account)
        except Exception as e:
            logger.error("Sync failed for account %s: %s", account.id, e, exc_info=True)
            account.sync_status = "error"
            await db.commit()