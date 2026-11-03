"""End-to-end test of a running stack (Next.js + Better Auth + FastAPI + Postgres), driven over HTTP the way
the browser does it. Skipped unless E2E_FRONTEND_URL and E2E_API_URL are set, e.g. against `docker compose up`:

    E2E_FRONTEND_URL=http://localhost:5173 E2E_API_URL=http://localhost:8000 pytest e2e

It signs up throwaway accounts with @e2e.test addresses; they stay in that stack's database afterwards.
"""
import json
import os
import uuid
from io import BytesIO

import httpx2 as httpx
import jwt
import pytest
from PIL import Image

FRONTEND = os.environ.get("E2E_FRONTEND_URL", "").rstrip("/")
API = os.environ.get("E2E_API_URL", "").rstrip("/")
pytestmark = pytest.mark.skipif(not (FRONTEND and API), reason="set E2E_FRONTEND_URL and E2E_API_URL to run")

PASSWORD = "E2e-pass-" + uuid.uuid4().hex[:8]
COURSE = {
    "title": "E2E course",
    "description": "Created by the end-to-end test.",
    "stages": [
        {
            "title": "Basics",
            "order": 1,
            "lessons": [
                {"title": "Intro video", "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "order": 1},
                {"title": "Reading", "url": "", "order": 2},
            ],
        }
    ],
}


class Browser:
    """One signed-in (or guest) person: a cookie jar for Better Auth plus the API token it hands out."""

    def __init__(self):
        # Better Auth only accepts state-changing requests from its own origin
        self.http = httpx.Client(timeout=20, headers={"Origin": FRONTEND})

    def auth(self, path, body=None):
        if body is None:
            return self.http.get(f"{FRONTEND}/api/auth/{path}")
        return self.http.post(f"{FRONTEND}/api/auth/{path}", json=body)

    def api_token(self):
        response = self.auth("get-session")
        assert response.status_code == 200
        return response.headers.get("set-auth-jwt")

    def api(self, method, path, token="current", **kwargs):
        token = self.api_token() if token == "current" else token
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        return self.http.request(method, f"{API}/api{path}", headers=headers, **kwargs)


def sign_up(role, name):
    person = Browser()
    email = f"{role}-{uuid.uuid4().hex[:10]}@e2e.test"
    response = person.auth("sign-up/email", {"name": name, "email": email, "password": PASSWORD, "role": role})
    assert response.status_code == 200, response.text
    person.email = email
    return person


def png():
    buffer = BytesIO()
    Image.new("RGB", (8, 8), "teal").save(buffer, "PNG")
    return buffer.getvalue()


def test_services_are_up():
    assert httpx.get(f"{API}/api/health/").json() == {"status": "ok"}
    assert httpx.get(f"{FRONTEND}/api/auth/ok").json() == {"ok": True}
    keys = httpx.get(f"{FRONTEND}/api/auth/jwks").json()["keys"]
    assert any(key.get("crv") == "Ed25519" for key in keys)


def test_sign_up_validation_happens_on_the_server():
    guest = Browser()
    base = {"name": "Val", "email": f"v-{uuid.uuid4().hex[:8]}@e2e.test", "password": PASSWORD, "role": "student"}
    cases = [
        {**base, "role": "admin"},
        {**base, "password": "short"},
        {**base, "email": "not-an-email"},
        {**base, "name": "   "},
        {**base, "name": "x" * 101},
    ]
    for body in cases:
        response = guest.auth("sign-up/email", body)
        assert response.status_code == 400, (body, response.text)


def test_session_cookie_is_http_only():
    person = Browser()
    response = person.auth(
        "sign-up/email", {"name": "Cookie", "email": f"c-{uuid.uuid4().hex[:8]}@e2e.test", "password": PASSWORD}
    )
    cookie = next(value for name, value in response.headers.multi_items() if name.lower() == "set-cookie")
    assert "HttpOnly" in cookie and "SameSite=Lax" in cookie


def test_full_teacher_and_student_flow():
    teacher = sign_up("teacher", "E2E Teacher")
    student = sign_up("student", "E2E Student")

    # the API token is a short-lived EdDSA JWT carrying the role
    token = teacher.api_token()
    header = jwt.get_unverified_header(token)
    claims = jwt.decode(token, options={"verify_signature": False})
    assert header["alg"] == "EdDSA"
    assert claims["role"] == "teacher" and claims["iss"] == FRONTEND and claims["exp"] - claims["iat"] <= 900

    # nobody can promote themselves; ordinary profile edits still work
    assert student.auth("update-user", {"role": "teacher"}).status_code == 403
    assert student.auth("update-user", {"name": "E2E Student Renamed"}).status_code == 200
    renamed = jwt.decode(student.api_token(), options={"verify_signature": False})
    assert renamed["name"] == "E2E Student Renamed" and renamed["role"] == "student"

    # teacher publishes a course with an image (multipart, like the create page)
    form = {"title": COURSE["title"], "description": COURSE["description"], "stages": json.dumps(COURSE["stages"])}
    cover = ("uploaded_images", ("cover.png", png(), "image/png"))
    created = teacher.api("POST", "/courses/create/", data=form, files=[cover])
    assert created.status_code == 201, created.text
    course = created.json()
    assert course["author"]["name"] == "E2E Teacher"
    image_url = course["images"][0]["image"]
    image = httpx.get(image_url)
    assert image.status_code == 200 and image.headers["content-type"] == "image/png"

    detail = Browser().api("GET", f"/courses/{course['id']}/", token=None)
    assert detail.status_code == 200
    assert [lesson["title"] for lesson in detail.json()["stages"][0]["lessons"]] == ["Intro video", "Reading"]

    # teachers see only their own courses; students and guests see the catalogue
    own = teacher.api("GET", "/courses/?limit=50").json()
    assert [c["id"] for c in own["results"]] == [course["id"]]
    catalogue = student.api("GET", "/courses/?limit=50").json()
    assert course["id"] in [c["id"] for c in catalogue["results"]]

    # students can't publish or delete; bad tokens and missing tokens are refused
    assert student.api("POST", "/courses/create/", json=COURSE).status_code == 403
    assert student.api("DELETE", f"/courses/{course['id']}/delete/").status_code == 403
    tampered = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
    assert teacher.api("DELETE", f"/courses/{course['id']}/delete/", token=tampered).status_code == 401
    assert teacher.api("POST", "/courses/create/", token=None, json=COURSE).status_code == 401

    # server-side validation reaches the client as a readable message
    invalid = teacher.api("POST", "/courses/create/", json={**COURSE, "title": "  "})
    assert invalid.status_code == 400 and invalid.json()["detail"] == "title: This field may not be blank."

    # deleting removes the course and its uploaded image
    assert teacher.api("DELETE", f"/courses/{course['id']}/delete/").status_code == 204
    assert Browser().api("GET", f"/courses/{course['id']}/", token=None).status_code == 404
    assert httpx.get(image_url).status_code == 404

    # signing out ends the session: no more API tokens
    assert teacher.auth("sign-out", {}).status_code == 200
    assert teacher.auth("get-session").json() is None
    assert teacher.api_token() is None

    # signing back in works only with the right password
    wrong = Browser().auth("sign-in/email", {"email": teacher.email, "password": "wrong-password"})
    assert wrong.status_code == 401
    again = Browser()
    assert again.auth("sign-in/email", {"email": teacher.email, "password": PASSWORD}).status_code == 200
    assert jwt.decode(again.api_token(), options={"verify_signature": False})["role"] == "teacher"
