import pytest


@pytest.mark.asyncio
async def test_credit_account_summary_calculates_liabilities_and_utilization(
    client, auth_headers
):
    headers = auth_headers("credit-user")

    asset_response = await client.post(
        "/accounts/",
        headers=headers,
        json={
            "name": "Checking",
            "provider": "manual",
            "type": "checking",
            "balance_current": 2500.0,
            "currency": "USD",
        },
    )
    assert asset_response.status_code == 200

    liability_response = await client.post(
        "/accounts/",
        headers=headers,
        json={
            "name": "Visa",
            "provider": "manual",
            "type": "credit",
            "balance_current": 500.0,
            "credit_limit": 2000.0,
            "statement_due_day": 25,
            "minimum_due": 35.0,
            "apr": 24.99,
            "currency": "USD",
        },
    )
    assert liability_response.status_code == 200

    summary_response = await client.get("/accounts/summary", headers=headers)
    assert summary_response.status_code == 200

    summary = summary_response.json()
    assert summary["total_assets"] == 2500.0
    assert summary["total_liabilities"] == 500.0
    assert summary["net_worth"] == 2000.0
    assert summary["total_balance"] == 2000.0

    visa = next(account for account in summary["accounts"] if account["name"] == "Visa")
    assert visa["account_class"] == "liability"
    assert visa["utilization_percent"] == 25.0


@pytest.mark.asyncio
async def test_budget_actuals_exclude_transfer_transactions(client, auth_headers):
    headers = auth_headers("budget-credit-user")

    account_response = await client.post(
        "/accounts/",
        headers=headers,
        json={
            "name": "Checking",
            "provider": "manual",
            "type": "checking",
            "balance_current": 1500.0,
            "currency": "USD",
        },
    )
    assert account_response.status_code == 200
    account_id = account_response.json()["id"]

    budget_response = await client.post(
        "/budgets/",
        headers=headers,
        json={
            "category": "Groceries",
            "amount": 500.0,
            "month": "2026-04",
            "period": "monthly",
        },
    )
    assert budget_response.status_code == 200

    expense_response = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": -100.0,
            "description": "Grocery Store",
            "category": "Groceries",
            "date": "2026-04-03",
            "is_manual": True,
            "tx_type": "expense",
        },
    )
    assert expense_response.status_code == 200

    transfer_response = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": -200.0,
            "description": "Credit card payment",
            "category": "Groceries",
            "date": "2026-04-04",
            "is_manual": True,
            "tx_type": "transfer",
        },
    )
    assert transfer_response.status_code == 200

    current_response = await client.get(
        "/budgets/current",
        headers=headers,
        params={"month": "2026-04", "period": "monthly"},
    )
    assert current_response.status_code == 200
    body = current_response.json()
    groceries_row = next(
        row for row in body["budgets"] if row["category"] == "Groceries"
    )

    assert groceries_row["spent"] == 100.0
    assert groceries_row["remaining"] == 400.0
    assert groceries_row["over_budget"] is False


@pytest.mark.asyncio
async def test_credit_account_balance_auto_updates_for_manual_transactions(
    client, auth_headers
):
    headers = auth_headers("credit-balance-user")

    account_response = await client.post(
        "/accounts/",
        headers=headers,
        json={
            "name": "Amex",
            "provider": "manual",
            "type": "credit",
            "balance_current": 500.0,
            "currency": "USD",
        },
    )
    assert account_response.status_code == 200
    account_id = account_response.json()["id"]

    expense_response = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": -120.0,
            "description": "Fuel",
            "category": "Gas",
            "date": "2026-04-05",
            "is_manual": True,
            "tx_type": "expense",
        },
    )
    assert expense_response.status_code == 200

    summary_after_expense = await client.get("/accounts/summary", headers=headers)
    assert summary_after_expense.status_code == 200
    amex_after_expense = next(
        row
        for row in summary_after_expense.json()["accounts"]
        if row["id"] == account_id
    )
    assert amex_after_expense["balance_current"] == 620.0

    income_response = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": 70.0,
            "description": "Card Payment",
            "category": "Payment",
            "date": "2026-04-06",
            "is_manual": True,
            "tx_type": "income",
        },
    )
    assert income_response.status_code == 200

    summary_after_income = await client.get("/accounts/summary", headers=headers)
    assert summary_after_income.status_code == 200
    amex_after_income = next(
        row
        for row in summary_after_income.json()["accounts"]
        if row["id"] == account_id
    )
    assert amex_after_income["balance_current"] == 550.0


@pytest.mark.asyncio
async def test_existing_account_can_be_edited(client, auth_headers):
    headers = auth_headers("edit-account-user")

    created = await client.post(
        "/accounts/",
        headers=headers,
        json={
            "name": "Old Card",
            "provider": "manual",
            "type": "credit",
            "balance_current": 100.0,
            "credit_limit": 1000.0,
            "currency": "USD",
        },
    )
    assert created.status_code == 200
    account_id = created.json()["id"]

    updated = await client.patch(
        f"/accounts/{account_id}",
        headers=headers,
        json={
            "name": "Updated Card",
            "balance_current": 250.5,
            "credit_limit": 3000.0,
            "statement_due_day": 17,
            "minimum_due": 45.0,
            "apr": 19.99,
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["name"] == "Updated Card"
    assert body["balance_current"] == 250.5
    assert body["credit_limit"] == 3000.0
    assert body["statement_due_day"] == 17
    assert body["minimum_due"] == 45.0
    assert body["apr"] == 19.99
