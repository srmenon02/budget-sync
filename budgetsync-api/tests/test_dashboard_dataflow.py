from datetime import date, timedelta

import pytest


@pytest.mark.asyncio
async def test_accounts_summary_returns_total_balance(client, auth_headers):
    headers = auth_headers("summary-user")

    await client.post(
        "/accounts/",
        headers=headers,
        json={
            "name": "Primary Checking",
            "provider": "manual",
            "type": "checking",
            "balance_current": 1200.50,
            "currency": "USD",
        },
    )
    await client.post(
        "/accounts/",
        headers=headers,
        json={
            "name": "Savings",
            "provider": "manual",
            "type": "savings",
            "balance_current": 800.00,
            "currency": "USD",
        },
    )

    response = await client.get("/accounts/summary", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total_balance"] == pytest.approx(2000.5)
    assert len(body["accounts"]) == 2


@pytest.mark.asyncio
async def test_transactions_support_filtering_and_sorting(client, auth_headers):
    headers = auth_headers("transactions-user")

    account_response = await client.post(
        "/accounts/",
        headers=headers,
        json={"name": "Checking", "provider": "manual", "currency": "USD"},
    )
    assert account_response.status_code == 200
    account_id = account_response.json()["id"]

    tx_one = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "external_id": None,
            "amount": -20.0,
            "description": "Groceries run",
            "merchant_name": None,
            "category": "Groceries",
            "date": "2026-03-05",
            "notes": None,
            "is_manual": True,
        },
    )
    assert tx_one.status_code == 200

    tx_two = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "external_id": None,
            "amount": 2000.0,
            "description": "Payroll",
            "merchant_name": None,
            "category": "Income",
            "date": "2026-03-10",
            "notes": None,
            "is_manual": True,
        },
    )
    assert tx_two.status_code == 200

    response = await client.get(
        "/transactions/",
        headers=headers,
        params={"type": "expense", "category": "groceries", "sort": "amount", "sort_dir": "asc"},
    )
    assert response.status_code == 200
    body = response.json()

    assert body["total_count"] == 1
    assert len(body["transactions"]) == 1
    assert body["transactions"][0]["description"] == "Groceries run"


@pytest.mark.asyncio
async def test_budget_current_includes_actual_spend(client, auth_headers):
    headers = auth_headers("budget-user")

    account_response = await client.post(
        "/accounts/",
        headers=headers,
        json={"name": "Checking", "provider": "manual", "currency": "USD"},
    )
    account_id = account_response.json()["id"]

    budget_response = await client.post(
        "/budgets/",
        headers=headers,
        json={"category": "Groceries", "amount": 300, "month": "2026-03"},
    )
    assert budget_response.status_code == 200

    tx_response = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "external_id": None,
            "amount": -120.0,
            "description": "Market",
            "merchant_name": None,
            "category": "Groceries",
            "date": "2026-03-12",
            "notes": None,
            "is_manual": True,
        },
    )
    assert tx_response.status_code == 200

    response = await client.get("/budgets/current", headers=headers, params={"month": "2026-03"})
    assert response.status_code == 200

    budgets = response.json()["budgets"]
    assert len(budgets) == 1
    assert budgets[0]["category"] == "Groceries"
    assert budgets[0]["spent"] == pytest.approx(120.0)
    assert budgets[0]["remaining"] == pytest.approx(180.0)
    assert budgets[0]["over_budget"] is False
    assert budgets[0]["period"] == "monthly"


@pytest.mark.asyncio
async def test_paycheck_budget_uses_current_pay_period_only(client, auth_headers):
    headers = auth_headers("paycheck-budget-user")

    account_response = await client.post(
        "/accounts/",
        headers=headers,
        json={"name": "Checking", "provider": "manual", "currency": "USD"},
    )
    assert account_response.status_code == 200
    account_id = account_response.json()["id"]

    budget_response = await client.post(
        "/budgets/",
        headers=headers,
        json={"category": "Groceries", "amount": 200, "month": "2026-04", "period": "paycheck"},
    )
    assert budget_response.status_code == 200

    early_paycheck_tx = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": -80.0,
            "description": "Early April groceries",
            "category": "Groceries",
            "date": "2026-04-10",
            "is_manual": True,
        },
    )
    assert early_paycheck_tx.status_code == 200

    late_paycheck_tx = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": -45.0,
            "description": "Late April groceries",
            "category": "Groceries",
            "date": "2026-04-18",
            "is_manual": True,
        },
    )
    assert late_paycheck_tx.status_code == 200

    response = await client.get(
        "/budgets/current",
        headers=headers,
        params={"month": "2026-04", "period": "paycheck", "start_date": "2026-04-01", "end_date": "2026-04-15"},
    )
    assert response.status_code == 200

    budgets = response.json()["budgets"]
    assert len(budgets) == 1
    assert budgets[0]["period"] == "paycheck"
    assert budgets[0]["spent"] == pytest.approx(80.0)
    assert budgets[0]["remaining"] == pytest.approx(120.0)


@pytest.mark.asyncio
async def test_payday_settings_drive_active_paycheck_window(client, auth_headers):
    headers = auth_headers("payday-settings-user")
    current_month = date.today().strftime("%Y-%m")

    me_response = await client.get("/auth/me", headers=headers)
    assert me_response.status_code == 200
    assert me_response.json()["primary_payday_day"] == 1
    assert me_response.json()["secondary_payday_day"] == 15

    update_response = await client.patch(
        "/auth/me",
        headers=headers,
        json={"primary_payday_day": 5, "secondary_payday_day": 20},
    )
    assert update_response.status_code == 200
    assert update_response.json()["primary_payday_day"] == 5
    assert update_response.json()["secondary_payday_day"] == 20

    account_response = await client.post(
        "/accounts/",
        headers=headers,
        json={"name": "Checking", "provider": "manual", "currency": "USD"},
    )
    assert account_response.status_code == 200
    account_id = account_response.json()["id"]

    budget_response = await client.post(
        "/budgets/",
        headers=headers,
        json={"category": "Groceries", "amount": 250, "month": current_month, "period": "paycheck"},
    )
    assert budget_response.status_code == 200

    preview_response = await client.get(
        "/budgets/current",
        headers=headers,
        params={"month": current_month, "period": "paycheck"},
    )
    assert preview_response.status_code == 200
    preview_body = preview_response.json()
    range_start = date.fromisoformat(preview_body["range_start"])
    range_end = date.fromisoformat(preview_body["range_end"])

    included_tx = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": -75.0,
            "description": "Included groceries",
            "category": "Groceries",
            "date": range_start.isoformat(),
            "is_manual": True,
        },
    )
    assert included_tx.status_code == 200

    excluded_tx = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": -40.0,
            "description": "Excluded groceries",
            "category": "Groceries",
            "date": (range_start - timedelta(days=1)).isoformat(),
            "is_manual": True,
        },
    )
    assert excluded_tx.status_code == 200

    response = await client.get(
        "/budgets/current",
        headers=headers,
        params={"month": current_month, "period": "paycheck"},
    )
    assert response.status_code == 200
    body = response.json()

    assert body["range_start"] == preview_body["range_start"]
    assert body["range_end"] == preview_body["range_end"]
    assert range_start < range_end
    assert body["budgets"][0]["spent"] == pytest.approx(75.0)


@pytest.mark.asyncio
async def test_reset_paycheck_budgets_clears_current_categories(client, auth_headers):
    headers = auth_headers("reset-paycheck-user")
    current_month = date.today().strftime("%Y-%m")

    account_response = await client.post(
        "/accounts/",
        headers=headers,
        json={"name": "Checking", "provider": "manual", "currency": "USD"},
    )
    assert account_response.status_code == 200
    account_id = account_response.json()["id"]

    first_budget = await client.post(
        "/budgets/",
        headers=headers,
        json={"category": "Groceries", "amount": 180, "month": current_month, "period": "paycheck"},
    )
    assert first_budget.status_code == 200

    second_budget = await client.post(
        "/budgets/",
        headers=headers,
        json={"category": "Dining", "amount": 90, "month": current_month, "period": "paycheck"},
    )
    assert second_budget.status_code == 200

    tx_response = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": -42.0,
            "description": "Lunch",
            "category": "Dining",
            "date": date.today().isoformat(),
            "is_manual": True,
        },
    )
    assert tx_response.status_code == 200

    before_reset = await client.get(
        "/budgets/current",
        headers=headers,
        params={"month": current_month, "period": "paycheck"},
    )
    assert before_reset.status_code == 200
    assert len(before_reset.json()["budgets"]) == 2

    reset_response = await client.delete(
        "/budgets/current",
        headers=headers,
        params={"month": current_month, "period": "paycheck"},
    )
    assert reset_response.status_code == 204

    after_reset = await client.get(
        "/budgets/current",
        headers=headers,
        params={"month": current_month, "period": "paycheck"},
    )
    assert after_reset.status_code == 200
    assert after_reset.json()["budgets"] == []


@pytest.mark.asyncio
async def test_reset_transactions_clears_current_filtered_scope(client, auth_headers):
    headers = auth_headers("reset-transactions-user")

    account_response = await client.post(
        "/accounts/",
        headers=headers,
        json={"name": "Checking", "provider": "manual", "currency": "USD"},
    )
    assert account_response.status_code == 200
    account_id = account_response.json()["id"]

    tx_one = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": -30.0,
            "description": "April grocery run",
            "category": "Groceries",
            "date": "2026-04-03",
            "is_manual": True,
        },
    )
    assert tx_one.status_code == 200

    tx_two = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": -45.0,
            "description": "March grocery run",
            "category": "Groceries",
            "date": "2026-03-20",
            "is_manual": True,
        },
    )
    assert tx_two.status_code == 200

    reset_response = await client.delete(
        "/transactions/current",
        headers=headers,
        params={"month": "2026-04", "type": "expense"},
    )
    assert reset_response.status_code == 204

    april_after = await client.get(
        "/transactions/",
        headers=headers,
        params={"month": "2026-04"},
    )
    assert april_after.status_code == 200
    assert april_after.json()["transactions"] == []

    march_after = await client.get(
        "/transactions/",
        headers=headers,
        params={"month": "2026-03"},
    )
    assert march_after.status_code == 200
    assert len(march_after.json()["transactions"]) == 1


@pytest.mark.asyncio
async def test_bulk_budget_import_upserts_multiple_categories(client, auth_headers):
    headers = auth_headers("bulk-budget-user")

    response = await client.post(
        "/budgets/bulk",
        headers=headers,
        json={
            "month": "2026-04",
            "period": "monthly",
            "items": [
                {"category": "Groceries", "amount": 500},
                {"category": "Transportation", "amount": 200},
                {"category": "Utilities", "amount": 150},
            ],
        },
    )
    assert response.status_code == 200
    assert len(response.json()) == 3

    budgets_response = await client.get(
        "/budgets/current",
        headers=headers,
        params={"month": "2026-04", "period": "monthly"},
    )
    assert budgets_response.status_code == 200
    categories = {row["category"] for row in budgets_response.json()["budgets"]}
    assert categories == {"Groceries", "Transportation", "Utilities"}


@pytest.mark.asyncio
async def test_bulk_transaction_import_creates_multiple_rows(client, auth_headers):
    headers = auth_headers("bulk-transaction-user")

    account_response = await client.post(
        "/accounts/",
        headers=headers,
        json={"name": "Checking", "provider": "manual", "currency": "USD"},
    )
    assert account_response.status_code == 200
    account_id = account_response.json()["id"]

    response = await client.post(
        "/transactions/bulk",
        headers=headers,
        json={
            "account_id": account_id,
            "items": [
                {"description": "Grocery Store", "amount": 85.4, "category": "Groceries", "date": "2026-04-04", "tx_type": "expense"},
                {"description": "Paycheck", "amount": 2500, "category": "Income", "date": "2026-04-05", "tx_type": "income"},
            ],
        },
    )
    assert response.status_code == 200
    assert len(response.json()) == 2

    list_response = await client.get(
        "/transactions/",
        headers=headers,
        params={"month": "2026-04"},
    )
    assert list_response.status_code == 200
    rows = list_response.json()["transactions"]
    assert len(rows) == 2
    amounts = sorted([float(row["amount"]) for row in rows])
    assert amounts == [-85.4, 2500.0]
