"""
conftest.py — Pytest fixtures for the backend test suite.

We use pytest fixtures to inject mock dependencies into our tests.
This ensures tests are fast, isolated, and don't require a running
Postgres or Redis server.
"""

import asyncio
import uuid
from typing import AsyncGenerator, Generator

import fakeredis
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db, get_redis_dep
from app.core.database import Base
from app.main import app

# ---------------------------------------------------------------------------
# Mock Database (SQLite in-memory)
# ---------------------------------------------------------------------------
# SQLite in-memory is fast and ephemeral. StaticPool ensures the same
# connection is used for all queries in a session.
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """
    Creates a fresh in-memory SQLite database for each test function.
    Yields the session, then drops all tables when the test completes.
    """
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# Mock Redis
# ---------------------------------------------------------------------------
@pytest.fixture(scope="function")
def mock_redis():
    """
    Returns a fakeredis instance. This behaves exactly like a real Redis
    server but runs entirely in memory.
    """
    # decode_responses=True matches our production redis_client config
    server = fakeredis.FakeServer()
    client = fakeredis.FakeRedis(server=server, decode_responses=True)
    yield client
    client.flushall()


# ---------------------------------------------------------------------------
# Test Client with Overrides
# ---------------------------------------------------------------------------
@pytest.fixture(scope="function")
def client(db_session, mock_redis) -> Generator[TestClient, None, None]:
    """
    A synchronous TestClient for testing normal HTTP routes.
    Overrides FastAPI dependencies to use the mock DB and mock Redis.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass # Session is closed by the db_session fixture

    def override_get_redis():
        return mock_redis

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis_dep] = override_get_redis

    from unittest.mock import patch
    with patch("app.api.ws.get_redis", return_value=mock_redis):
        with TestClient(app) as c:
            yield c

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def async_client(db_session, mock_redis) -> AsyncGenerator[AsyncClient, None]:
    """
    An asynchronous TestClient for testing WebSockets or fully async flows.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_redis():
        return mock_redis

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis_dep] = override_get_redis

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Auth Helpers
# ---------------------------------------------------------------------------
@pytest.fixture(scope="function")
def auth_headers(client: TestClient) -> dict[str, str]:
    """
    Registers a dummy user, logs them in, and returns the Authorization header
    needed for protected routes.
    """
    # 1. Register
    email = f"test_{uuid.uuid4()}@example.com"
    password = "securepassword123"
    client.post("/auth/register", json={"email": email, "password": password})

    # 2. Login (OAuth2 uses form data)
    login_res = client.post("/auth/token", data={"username": email, "password": password})
    token = login_res.json()["access_token"]

    # 3. Return header
    return {"Authorization": f"Bearer {token}"}
