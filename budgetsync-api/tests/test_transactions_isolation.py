import pytest


@pytest.mark.asyncio
async def test_rejects_missing_bearer_token(client):
    response = await client.get("/transactions/")

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing bearer token"


@pytest.mark.asyncio
async def test_transactions_are_isolated_per_user(client, auth_headers):
    owner_headers = auth_headers("user-a")
    other_headers = auth_headers("user-b")

    account_response = await client.post(
        "/accounts/",
        headers=owner_headers,
        json={
            "name": "Checking",
            "provider": "manual",
            "currency": "USD",
        },
    )
    assert account_response.status_code == 200
    account_id = account_response.json()["id"]

    create_tx_response = await client.post(
        "/transactions/",
        headers=owner_headers,
        json={
            "account_id": account_id,
            "external_id": None,
            "amount": -12.34,
            "description": "Coffee",
            "merchant_name": None,
            "category": None,
            "date": "2026-03-01",
            "is_manual": True,
        },
    )
    assert create_tx_response.status_code == 200
    created_tx_id = create_tx_response.json()["id"]

    owner_list_response = await client.get("/transactions/", headers=owner_headers)
    assert owner_list_response.status_code == 200
    owner_ids = {tx["id"] for tx in owner_list_response.json()["transactions"]}
    assert created_tx_id in owner_ids

    other_list_response = await client.get("/transactions/", headers=other_headers)
    assert other_list_response.status_code == 200
    other_ids = {tx["id"] for tx in other_list_response.json()["transactions"]}
    assert created_tx_id not in other_ids


@pytest.mark.asyncio
async def test_cannot_create_transaction_on_other_users_account(client, auth_headers):
    owner_headers = auth_headers("user-a")
    intruder_headers = auth_headers("user-b")

    account_response = await client.post(
        "/accounts/",
        headers=owner_headers,
        json={
            "name": "Savings",
            "provider": "manual",
            "currency": "USD",
        },
    )
    assert account_response.status_code == 200
    account_id = account_response.json()["id"]

    forbidden_response = await client.post(
        "/transactions/",
        headers=intruder_headers,
        json={
            "account_id": account_id,
            "external_id": None,
            "amount": -50.0,
            "description": "Unauthorized",
            "merchant_name": None,
            "category": None,
            "date": "2026-03-02",
            "is_manual": True,
        },
    )

    assert forbidden_response.status_code == 403
    assert "access" in forbidden_response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_owner_can_update_and_delete_transaction(client, auth_headers):
    headers = auth_headers("user-owner")

    account_response = await client.post(
        "/accounts/",
        headers=headers,
        json={
            "name": "Checking",
            "provider": "manual",
            "currency": "USD",
        },
    )
    assert account_response.status_code == 200
    account_id = account_response.json()["id"]

    create_response = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": -25.0,
            "description": "Lunch",
            "category": "Food",
            "date": "2026-04-03",
            "is_manual": True,
        },
    )
    assert create_response.status_code == 200
    tx_id = create_response.json()["id"]

    update_response = await client.patch(
        f"/transactions/{tx_id}",
        headers=headers,
        json={
            "amount": -30.0,
            "description": "Lunch + coffee",
            "category": "Dining",
        },
    )
    assert update_response.status_code == 200
    assert float(update_response.json()["amount"]) == -30.0
    assert update_response.json()["description"] == "Lunch + coffee"
    assert update_response.json()["category"] == "Dining"

    delete_response = await client.delete(f"/transactions/{tx_id}", headers=headers)
    assert delete_response.status_code == 204


@pytest.mark.asyncio
async def test_user_cannot_update_or_delete_other_users_transaction(
    client, auth_headers
):
    owner_headers = auth_headers("owner-user")
    intruder_headers = auth_headers("intruder-user")

    account_response = await client.post(
        "/accounts/",
        headers=owner_headers,
        json={
            "name": "Savings",
            "provider": "manual",
            "currency": "USD",
        },
    )
    assert account_response.status_code == 200
    account_id = account_response.json()["id"]

    create_response = await client.post(
        "/transactions/",
        headers=owner_headers,
        json={
            "account_id": account_id,
            "amount": -45.0,
            "description": "Groceries",
            "category": "Groceries",
            "date": "2026-04-03",
            "is_manual": True,
        },
    )
    assert create_response.status_code == 200
    tx_id = create_response.json()["id"]

    patch_response = await client.patch(
        f"/transactions/{tx_id}",
        headers=intruder_headers,
        json={"description": "Hacked"},
    )
    assert patch_response.status_code == 404

    delete_response = await client.delete(
        f"/transactions/{tx_id}", headers=intruder_headers
    )
    assert delete_response.status_code == 404
