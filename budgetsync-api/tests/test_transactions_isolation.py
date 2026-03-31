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
