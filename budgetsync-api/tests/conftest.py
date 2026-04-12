from collections.abc import AsyncGenerator, Callable, Generator
from pathlib import Path

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Import models so SQLAlchemy metadata includes all tables.
import app.models as models  # noqa: F401
from app.database import Base
from app.dependencies import get_db
from app.main import app

TEST_DB_PATH = Path("test_ci.db")
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_PATH}"
TEST_SECRET = "test-secret"

engine = create_async_engine(TEST_DATABASE_URL, future=True, echo=False)
TestSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
def configure_auth_env(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("DEV_AUTH_BYPASS", "false")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_SECRET)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_database() -> AsyncGenerator[None, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()


@pytest_asyncio.fixture(autouse=True)
def override_db_dependency() -> Generator[None, None, None]:
    async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
        async with TestSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as async_client:
        yield async_client


@pytest_asyncio.fixture
def auth_headers() -> Callable[[str], dict[str, str]]:
    def _headers(user_id: str) -> dict[str, str]:
        token = jwt.encode({"sub": user_id}, TEST_SECRET, algorithm="HS256")
        return {"Authorization": f"Bearer {token}"}

    return _headers
