"""Test setup: a dedicated "<POSTGRES_DB>_test" database migrated with Alembic, emptied between tests,
plus locally signed Better Auth-style tokens (the JWKS lookup is replaced by the test key)."""
import json
import os
import tempfile
import time
from pathlib import Path

import jwt
import psycopg
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

TEST_DB = os.environ.get("POSTGRES_DB", "eduhub").removesuffix("_test") + "_test"
ISSUER = "http://auth.test"

# must be set before the app (and its cached settings / engine) is imported
os.environ.update(
    POSTGRES_DB=TEST_DB,
    BETTER_AUTH_URL=ISSUER,
    ALLOWED_HOSTS="testserver,localhost",
    CORS_ALLOWED_ORIGINS="http://localhost:5173",
    MEDIA_ROOT=tempfile.mkdtemp(prefix="eduhub-test-media-"),
    ENVIRONMENT="test",
)

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _create_test_database() -> None:
    settings = get_settings()
    assert settings.postgres_db.endswith("_test"), "refusing to run tests against a non-test database"
    with psycopg.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        user=settings.postgres_user,
        password=settings.postgres_password,
        dbname="postgres",
        autocommit=True,
    ) as conn:
        if not conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (settings.postgres_db,)).fetchone():
            conn.execute(f'CREATE DATABASE "{settings.postgres_db}"')


@pytest.fixture(scope="session", autouse=True)
def database():
    _create_test_database()
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
    command.upgrade(Config(str(BACKEND_DIR / "alembic.ini")), "head")
    yield


@pytest.fixture(autouse=True)
def clean_tables():
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE users, courses, course_images, stages, lessons RESTART IDENTITY CASCADE"))


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def make_key():
    private_key = Ed25519PrivateKey.generate()
    public_jwk = json.loads(jwt.algorithms.OKPAlgorithm.to_jwk(private_key.public_key()))
    return private_key, jwt.PyJWK.from_dict({**public_jwk, "kid": "test-key", "alg": "EdDSA"})


class FakeJWKSClient:
    def __init__(self, public_jwk):
        self.public_jwk = public_jwk

    def get_signing_key_from_jwt(self, token):
        jwt.get_unverified_header(token)  # malformed tokens fail here, like the real client
        return self.public_jwk


@pytest.fixture
def signing_key(monkeypatch):
    private_key, public_jwk = make_key()
    monkeypatch.setattr("app.auth.get_jwks_client", lambda: FakeJWKSClient(public_jwk))
    return private_key


@pytest.fixture
def make_token(signing_key):
    """make_token(role="teacher", sub="u1", **claim_overrides); pass a claim as None to leave it out."""

    def _make(role="teacher", sub="ba-user-1", key=None, **overrides):
        now = int(time.time())
        claims = {
            "sub": sub,
            "email": f"{sub}@example.test",
            "name": f"User {sub}",
            "role": role,
            "iss": ISSUER,
            "aud": ISSUER,
            "iat": now,
            "exp": now + 900,
            **overrides,
        }
        claims = {name: value for name, value in claims.items() if value is not None}
        return jwt.encode(claims, key or signing_key, algorithm="EdDSA", headers={"kid": "test-key"})

    return _make


@pytest.fixture
def auth(make_token):
    """auth(role=..., sub=...) -> headers for an authenticated request."""
    return lambda role="teacher", sub="ba-user-1", **claims: {"Authorization": f"Bearer {make_token(role, sub, **claims)}"}
