import pytest


@pytest.mark.asyncio
async def test_create_loan_returns_loan_with_id(client, auth_headers):
    """Test creating a new loan"""
    headers = auth_headers("loan-user-1")

    response = await client.post(
        "/loans/",
        headers=headers,
        json={
            "name": "Student Loan",
            "principal_amount": 30000.0,
            "current_balance": 18250.0,
            "interest_rate": 4.75,
            "start_date": "2020-01-15",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Student Loan"
    assert body["principal_amount"] == 30000.0
    assert body["current_balance"] == 18250.0
    assert body["interest_rate"] == 4.75
    assert body["start_date"] == "2020-01-15"
    assert body["id"]
    assert body["user_id"] == "loan-user-1"


@pytest.mark.asyncio
async def test_create_loan_without_start_date(client, auth_headers):
    """Test creating a loan without start date"""
    headers = auth_headers("loan-user-1b")

    response = await client.post(
        "/loans/",
        headers=headers,
        json={
            "name": "Car Loan",
            "principal_amount": 25000.0,
            "current_balance": 21000.0,
            "interest_rate": 6.1,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Car Loan"
    assert body["start_date"] is None
    assert body["current_balance"] == 21000.0
    assert body["interest_rate"] == 6.1


@pytest.mark.asyncio
async def test_get_all_loans_returns_user_loans(client, auth_headers):
    """Test retrieving all loans for a user"""
    headers = auth_headers("loan-user-2")

    # Create two loans
    await client.post(
        "/loans/",
        headers=headers,
        json={
            "name": "Student Loan",
            "principal_amount": 30000.0,
            "current_balance": 29500.0,
            "interest_rate": 5.25,
            "start_date": "2020-01-15",
        },
    )

    await client.post(
        "/loans/",
        headers=headers,
        json={
            "name": "Car Loan",
            "principal_amount": 25000.0,
            "current_balance": 17000.0,
            "interest_rate": 3.5,
            "start_date": "2022-06-01",
        },
    )

    response = await client.get("/loans/", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert body[0]["name"] in ["Student Loan", "Car Loan"]
    assert body[1]["name"] in ["Student Loan", "Car Loan"]


@pytest.mark.asyncio
async def test_record_payment_reduces_balance(client, auth_headers):
    """Test recording a payment reduces the loan balance"""
    headers = auth_headers("loan-user-3")

    # Create a loan
    loan_response = await client.post(
        "/loans/",
        headers=headers,
        json={
            "name": "Student Loan",
            "principal_amount": 5000.0,
            "current_balance": 5000.0,
            "interest_rate": 5.0,
            "start_date": "2023-01-01",
        },
    )
    assert loan_response.status_code == 200
    loan_id = loan_response.json()["id"]

    # Record a payment
    payment_response = await client.post(
        f"/loans/{loan_id}/payments",
        headers=headers,
        json={
            "amount": 250.0,
            "payment_date": "2023-02-01",
        },
    )
    assert payment_response.status_code == 200
    payment_body = payment_response.json()
    assert payment_body["amount"] == 250.0

    # Check that balance was reduced
    loan_detail_response = await client.get(f"/loans/{loan_id}", headers=headers)
    assert loan_detail_response.status_code == 200
    detail_body = loan_detail_response.json()
    assert detail_body["current_balance"] == pytest.approx(4750.0)


@pytest.mark.asyncio
async def test_get_loan_includes_payment_history(client, auth_headers):
    """Test getting loan detail with payment history"""
    headers = auth_headers("loan-user-4")

    # Create a loan
    loan_response = await client.post(
        "/loans/",
        headers=headers,
        json={
            "name": "Test Loan",
            "principal_amount": 1000.0,
            "current_balance": 1000.0,
            "interest_rate": 4.0,
            "start_date": "2023-01-01",
        },
    )
    loan_id = loan_response.json()["id"]

    # Record multiple payments
    await client.post(
        f"/loans/{loan_id}/payments",
        headers=headers,
        json={
            "amount": 100.0,
            "payment_date": "2023-02-01",
        },
    )
    await client.post(
        f"/loans/{loan_id}/payments",
        headers=headers,
        json={
            "amount": 100.0,
            "payment_date": "2023-03-01",
        },
    )

    # Get loan
    response = await client.get(f"/loans/{loan_id}", headers=headers)
    assert response.status_code == 200
    body = response.json()

    assert body["name"] == "Test Loan"
    assert body["current_balance"] == pytest.approx(800.0)  # 1000 - 100 - 100


@pytest.mark.asyncio
async def test_update_loan_modifies_fields(client, auth_headers):
    """Test updating loan fields"""
    headers = auth_headers("loan-user-5")

    # Create a loan
    loan_response = await client.post(
        "/loans/",
        headers=headers,
        json={
            "name": "Student Loan",
            "principal_amount": 30000.0,
            "current_balance": 15000.0,
            "interest_rate": 4.5,
            "start_date": "2020-01-15",
        },
    )
    loan_id = loan_response.json()["id"]

    # Update the loan  name
    response = await client.put(
        f"/loans/{loan_id}",
        headers=headers,
        json={
            "name": "Consolidated Student Loan",
            "interest_rate": 3.9,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Consolidated Student Loan"
    assert body["interest_rate"] == 3.9


@pytest.mark.asyncio
async def test_delete_loan_removes_loan_and_payments(client, auth_headers):
    """Test deleting a loan cascades to payment deletion"""
    headers = auth_headers("loan-user-6")

    # Create a loan
    loan_response = await client.post(
        "/loans/",
        headers=headers,
        json={
            "name": "Test Loan",
            "principal_amount": 5000.0,
            "current_balance": 5000.0,
            "interest_rate": 7.25,
            "start_date": "2023-01-01",
        },
    )
    loan_id = loan_response.json()["id"]

    # Record a payment
    await client.post(
        f"/loans/{loan_id}/payments",
        headers=headers,
        json={
            "amount": 250.0,
            "payment_date": "2023-02-01",
        },
    )

    # Delete the loan
    delete_response = await client.delete(f"/loans/{loan_id}", headers=headers)
    assert delete_response.status_code == 204

    # Verify loan is deleted
    get_response = await client.get(f"/loans/{loan_id}", headers=headers)
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_get_nonexistent_loan_returns_404(client, auth_headers):
    """Test getting a non-existent loan returns 404"""
    headers = auth_headers("loan-user-7")

    response = await client.get("/loans/fake-loan-id", headers=headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_users_cannot_access_other_users_loans(client, auth_headers):
    """Test that users can only access their own loans"""
    user1_headers = auth_headers("user-1")
    user2_headers = auth_headers("user-2")

    # User 1 creates a loan
    loan_response = await client.post(
        "/loans/",
        headers=user1_headers,
        json={
            "name": "Private Loan",
            "principal_amount": 5000.0,
            "current_balance": 4100.0,
            "interest_rate": 5.2,
            "start_date": "2023-01-01",
        },
    )
    loan_id = loan_response.json()["id"]

    # User 2 tries to access user 1's loan
    response = await client.get(f"/loans/{loan_id}", headers=user2_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_loan_payments_filtered_by_user(client, auth_headers):
    """Test retrieving payments for a specific loan"""
    headers = auth_headers("loan-user-8")

    # Create a loan
    loan_response = await client.post(
        "/loans/",
        headers=headers,
        json={
            "name": "Test Loan",
            "principal_amount": 1000.0,
            "current_balance": 1000.0,
            "interest_rate": 2.5,
            "start_date": "2023-01-01",
        },
    )
    loan_id = loan_response.json()["id"]

    # Record three payments
    for i in range(3):
        await client.post(
            f"/loans/{loan_id}/payments",
            headers=headers,
            json={
                "amount": 100.0,
                "payment_date": f"2023-0{i+2}-01",
            },
        )

    # Get payments
    response = await client.get(f"/loans/{loan_id}/payments", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 3


@pytest.mark.asyncio
async def test_transaction_with_loan_id_updates_balance(client, auth_headers):
    """Test creating a transaction with loan_id automatically reduces loan balance"""
    headers = auth_headers("loan-user-9")

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

    loan_response = await client.post(
        "/loans/",
        headers=headers,
        json={
            "name": "Student Loan",
            "principal_amount": 4000.0,
            "current_balance": 3500.0,
            "interest_rate": 4.2,
            "start_date": "2023-01-01",
        },
    )
    assert loan_response.status_code == 200
    loan_id = loan_response.json()["id"]

    transaction_response = await client.post(
        "/transactions/",
        headers=headers,
        json={
            "account_id": account_id,
            "amount": -150.0,
            "description": "Loan payment",
            "category": "Debt",
            "date": "2023-02-01",
            "is_manual": True,
            "loan_id": loan_id,
        },
    )
    assert transaction_response.status_code == 200

    updated_loan_response = await client.get(f"/loans/{loan_id}", headers=headers)
    assert updated_loan_response.status_code == 200
    updated_loan_body = updated_loan_response.json()
    assert updated_loan_body["current_balance"] == pytest.approx(3350.0)
    assert updated_loan_body["interest_rate"] == pytest.approx(4.2)
