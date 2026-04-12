import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_register_user(client: AsyncClient):
    payload = {
        "supabase_id": "supabase-test-001",
        "email": "test@example.com",
        "display_name": "Test User",
    }
    response = await client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["supabase_id"] == "supabase-test-001"


@pytest.mark.asyncio
async def test_register_idempotent(client: AsyncClient):
    payload = {
        "supabase_id": "supabase-test-002",
        "email": "idempotent@example.com",
    }
    r1 = await client.post("/auth/register", json=payload)
    r2 = await client.post("/auth/register", json=payload)
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"]


@pytest.mark.asyncio
async def test_me_requires_auth(client: AsyncClient):
    response = await client.get("/auth/me")
    assert response.status_code == 401
