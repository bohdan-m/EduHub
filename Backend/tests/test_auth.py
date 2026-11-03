import time

import jwt
import pytest
from sqlalchemy import select, update

from app.models import User
from tests.conftest import ISSUER, make_key

COURSE = {
    "title": "Course",
    "description": "Desc",
    "stages": [{"title": "S1", "order": 1, "lessons": [{"title": "L1", "order": 1}]}],
}


def test_valid_token_creates_local_user(client, db, auth):
    response = client.get("/api/courses/", headers=auth(role="teacher", sub="ada", name="Ada Lovelace"))

    assert response.status_code == 200
    user = db.scalar(select(User).where(User.auth_id == "ada"))
    assert (user.email, user.name, user.role) == ("ada@example.test", "Ada Lovelace", "teacher")


def test_later_token_updates_mirrored_fields(client, db, auth):
    client.get("/api/courses/", headers=auth(sub="ada", name="Ada Lovelace"))
    client.get("/api/courses/", headers=auth(sub="ada", name="Ada King", email="ada.king@example.test"))

    users = db.scalars(select(User).where(User.auth_id == "ada")).all()
    assert [(u.name, u.email) for u in users] == [("Ada King", "ada.king@example.test")]


@pytest.mark.parametrize(
    "overrides",
    [
        pytest.param({"iat": int(time.time()) - 3600, "exp": int(time.time()) - 1800}, id="expired"),
        pytest.param({"iss": "http://evil.test"}, id="wrong issuer"),
        pytest.param({"aud": "http://other-app.test"}, id="wrong audience"),
        pytest.param({"role": None}, id="no role"),
        pytest.param({"role": "admin"}, id="unknown role"),
        pytest.param({"sub": None}, id="no subject"),
        pytest.param({"exp": None}, id="no expiry"),
    ],
)
def test_rejected_claims_return_401(client, db, make_token, overrides):
    token = make_token(**overrides)
    response = client.get("/api/courses/", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.headers["www-authenticate"].startswith("Bearer")
    assert db.scalar(select(User)) is None


def test_token_signed_by_another_key_is_rejected(client, make_token):
    other_key, _ = make_key()
    response = client.get("/api/courses/", headers={"Authorization": f"Bearer {make_token(key=other_key)}"})
    assert response.status_code == 401


def test_hs256_token_is_rejected(client, signing_key):
    # algorithm confusion: a token "signed" with a shared secret must never be accepted
    now = int(time.time())
    forged = jwt.encode(
        {"sub": "x", "role": "teacher", "iss": ISSUER, "aud": ISSUER, "iat": now, "exp": now + 900},
        "a-shared-secret-an-attacker-might-guess-0123456789",
        algorithm="HS256",
    )
    assert client.get("/api/courses/", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


@pytest.mark.parametrize("header", ["Bearer", "Bearer not-a-jwt", "Token abc", "Bearer a b"])
def test_malformed_authorization_header_is_rejected(client, signing_key, header):
    assert client.get("/api/courses/", headers={"Authorization": header}).status_code == 401


def test_inactive_user_is_rejected(client, db, auth):
    client.get("/api/courses/", headers=auth(sub="ada"))
    db.execute(update(User).where(User.auth_id == "ada").values(is_active=False))
    db.commit()

    assert client.get("/api/courses/", headers=auth(sub="ada")).status_code == 401


def test_jwks_outage_is_a_401_not_a_crash(client, make_token, monkeypatch):
    token = make_token()

    class Down:
        def get_signing_key_from_jwt(self, _token):
            raise jwt.PyJWKClientConnectionError("connection refused")

    monkeypatch.setattr("app.auth.get_jwks_client", lambda: Down())
    response = client.get("/api/courses/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Could not verify the token right now."


def test_guest_can_browse_but_not_create(client):
    assert client.get("/api/courses/").status_code == 200
    assert client.post("/api/courses/create/", json=COURSE).status_code == 401


def test_student_cannot_create_or_delete(client, auth):
    assert client.post("/api/courses/create/", json=COURSE, headers=auth(role="student")).status_code == 403
    assert client.delete("/api/courses/1/delete/", headers=auth(role="student")).status_code == 403
