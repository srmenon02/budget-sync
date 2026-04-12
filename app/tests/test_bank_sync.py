import uuid
from datetime import date, datetime
from unittest.mock import AsyncMock, patch

import pytest

from app.models.account import FinancialAccount
from app.services.bank_sync.sync import sync_account


@pytest.mark.asyncio
async def test_sync_skips_manual_account(db_session):
    account = FinancialAccount(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        institution_name="Test Bank",
        account_name="Checking",
        account_type="depository",
        is_manual=True,
        sync_status="manual",
    )
    db_session.add(account)
    await db_session.commit()

    count = await sync_account(db_session, account)
    assert count == 0


@pytest.mark.asyncio
async def test_sync_account_inserts_transactions(db_session):
    from app.utils.encryption import encrypt_token

    account = FinancialAccount(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        institution_name="Chase",
        account_name="Checking",
        account_type="depository",
        teller_account_id="teller-acct-123",
        encrypted_access_token=encrypt_token("fake-access-token"),
        is_manual=False,
        sync_status="pending",
    )
    db_session.add(account)
    await db_session.commit()

    mock_transactions = [
        {
            "id": "tx-001",
            "amount": "-42.50",
            "date": date.today().isoformat(),
            "description": "Coffee Shop",
            "merchant": {"name": "Starbucks"},
            "details": {"category": "food_and_drink"},
        }
    ]
    mock_balance = {"available": "1200.00", "ledger": "1200.00"}

    with patch(
        "app.services.bank_sync.sync.TellerClient.get_transactions",
        new=AsyncMock(return_value=mock_transactions),
    ), patch(
        "app.services.bank_sync.sync.TellerClient.get_account_balance",
        new=AsyncMock(return_value=mock_balance),
    ):
        count = await sync_account(db_session, account)

    assert count == 1
    await db_session.refresh(account)
    assert account.sync_status == "ok"
    assert float(account.current_balance) == 1200.0


@pytest.mark.asyncio
async def test_sync_skips_duplicate_transactions(db_session):
    from app.models.transaction import Transaction
    from app.utils.encryption import encrypt_token

    acct_id = uuid.uuid4()
    account = FinancialAccount(
        id=acct_id,
        owner_id=uuid.uuid4(),
        institution_name="Chase",
        account_name="Savings",
        account_type="depository",
        teller_account_id="teller-acct-456",
        encrypted_access_token=encrypt_token("fake-access-token"),
        is_manual=False,
        sync_status="ok",
        last_synced_at=datetime.utcnow(),
    )
    db_session.add(account)

    existing_tx = Transaction(
        id=uuid.uuid4(),
        account_id=acct_id,
        teller_transaction_id="tx-existing",
        amount=-10.0,
        transaction_date=date.today(),
    )
    db_session.add(existing_tx)
    await db_session.commit()

    mock_transactions = [
        {"id": "tx-existing", "amount": "-10.00", "date": date.today().isoformat()}
    ]
    mock_balance = {"available": "500.00"}

    with patch(
        "app.services.bank_sync.sync.TellerClient.get_transactions",
        new=AsyncMock(return_value=mock_transactions),
    ), patch(
        "app.services.bank_sync.sync.TellerClient.get_account_balance",
        new=AsyncMock(return_value=mock_balance),
    ):
        count = await sync_account(db_session, account)

    assert count == 0
