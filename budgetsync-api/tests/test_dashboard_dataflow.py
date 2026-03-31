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
