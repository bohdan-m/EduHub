"""End-to-end test of a running stack (Next.js + Better Auth + FastAPI + Postgres + Mailpit), driven over HTTP the way
the browser does it. Skipped unless E2E_FRONTEND_URL and E2E_API_URL are set, e.g. against `docker compose up`:

    E2E_FRONTEND_URL=http://localhost:5173 E2E_API_URL=http://localhost:8000 pytest e2e

Confirmation emails are read from Mailpit's API (E2E_MAILPIT_URL, default http://localhost:8025), so nothing is sent
for real. It signs up throwaway accounts with @e2e.test addresses; they stay in that stack's database afterwards.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import struct
import time
import uuid
from io import BytesIO
from urllib.parse import parse_qs, urlparse

import httpx2 as httpx
import jwt
import pytest
from PIL import Image

FRONTEND = os.environ.get("E2E_FRONTEND_URL", "").rstrip("/")
API = os.environ.get("E2E_API_URL", "").rstrip("/")
MAILPIT = os.environ.get("E2E_MAILPIT_URL", "http://localhost:8025").rstrip("/")
pytestmark = pytest.mark.skipif(not (FRONTEND and API), reason="set E2E_FRONTEND_URL and E2E_API_URL to run")

PASSWORD = "E2e-pass-" + uuid.uuid4().hex[:8]
COURSE = {
    "title": "E2E course",
    "description": "Created by the end-to-end test.",
    "status": "published",  # new courses are private drafts otherwise
    "stages": [
        {
            "title": "Basics",
            "order": 1,
            "lessons": [
                {"title": "Intro video", "order": 1,
                 "blocks": [{"type": "video", "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}]},
                {"title": "Reading", "order": 2, "blocks": [
                    {"type": "text", "text": "## Read this\n\nSome **markdown**."},
                    {"type": "link", "url": "https://example.com/guide", "title": "The guide"},
                    {"type": "callout", "tone": "warning", "text": "Mind the gap."},
                    {"type": "quiz", "question": "2 + 2?", "options": [{"text": "4", "correct": True}, {"text": "5"}]},
                ]},
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


def new_email(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:10]}@e2e.test"


def emailed_links(email, count=1):
    """Links in the mail Mailpit caught for this address, newest first; waits for the mail to arrive."""
    for _ in range(40):
        found = httpx.get(f"{MAILPIT}/api/v1/search", params={"query": f'to:"{email}"'}).json()["messages"]
        if len(found) >= count:
            texts = [httpx.get(f"{MAILPIT}/api/v1/message/{m['ID']}").json()["Text"] for m in found]
            return [re.search(r"https?://\S+", text).group(0) for text in texts]
        time.sleep(0.25)
    raise AssertionError(f"no email for {email} reached Mailpit")


def totp(totp_uri):
    """The current 6-digit code for an otpauth:// URI (RFC 6238, SHA-1, 30 s), as an authenticator app shows it."""
    secret = parse_qs(urlparse(totp_uri).query)["secret"][0]
    key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    digest = hmac.new(key, struct.pack(">Q", int(time.time()) // 30), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    return f"{(struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000:06d}"


def sign_up(name):
    """A new account with its email confirmed through the emailed link, which also signs it in."""
    person = Browser()
    email = new_email("user")
    response = person.auth("sign-up/email", {"name": name, "email": email, "password": PASSWORD, "callbackURL": "/login"})
    assert response.status_code == 200, response.text
    assert person.auth("get-session").json() is None  # no session before the address is confirmed
    confirmed = person.http.get(emailed_links(email)[0], follow_redirects=True)
    assert confirmed.status_code == 200 and urlparse(str(confirmed.url)).path == "/home"
    person.email = email
    person.confirmation = confirmed.history[0]
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
    base = {"name": "Val", "email": new_email("v"), "password": PASSWORD}
    cases = [
        {**base, "password": "short"},
        {**base, "email": "not-an-email"},
        {**base, "name": "   "},
        {**base, "name": "x" * 101},
    ]
    for body in cases:
        response = guest.auth("sign-up/email", body)
        assert response.status_code == 400, (body, response.text)


def test_unconfirmed_account_cannot_sign_in_and_gets_a_fresh_link():
    person = Browser()
    email = new_email("unconfirmed")
    assert person.auth("sign-up/email", {"name": "Pending", "email": email, "password": PASSWORD}).status_code == 200
    emailed_links(email)

    response = person.auth("sign-in/email", {"email": email, "password": PASSWORD})
    assert response.status_code == 403 and response.json()["code"] == "EMAIL_NOT_VERIFIED"
    assert person.api_token() is None
    emailed_links(email, count=2)  # the refused sign-in sent another link

    # a made-up token confirms nothing
    person.http.get(f"{FRONTEND}/api/auth/verify-email?token=forged")
    assert person.auth("sign-in/email", {"email": email, "password": PASSWORD}).status_code == 403


def test_session_cookie_is_http_only():
    headers = sign_up("Cookie").confirmation.headers
    cookie = next(value for name, value in headers.multi_items() if name.lower() == "set-cookie")
    assert "HttpOnly" in cookie and "SameSite=Lax" in cookie


def test_full_flow_with_two_factor():
    ada = sign_up("E2E Ada")
    bob = sign_up("E2E Bob")

    # the API token is a short-lived EdDSA JWT; it no longer carries a role
    token = ada.api_token()
    header = jwt.get_unverified_header(token)
    claims = jwt.decode(token, options={"verify_signature": False})
    assert header["alg"] == "EdDSA"
    assert "role" not in claims and claims["iss"] == FRONTEND and claims["exp"] - claims["iat"] <= 900

    assert bob.auth("update-user", {"name": "E2E Bob Renamed"}).status_code == 200
    assert jwt.decode(bob.api_token(), options={"verify_signature": False})["name"] == "E2E Bob Renamed"

    # any account creates courses (multipart with an image, like the create page)
    form = {"title": COURSE["title"], "description": COURSE["description"], "status": "published",
            "stages": json.dumps(COURSE["stages"])}
    cover = ("uploaded_images", ("cover.png", png(), "image/png"))
    created = ada.api("POST", "/courses/create/", data=form, files=[cover])
    assert created.status_code == 201, created.text
    course = created.json()
    assert course["author"] == {"id": course["author"]["id"], "name": "E2E Ada", "headline": ""}
    image_url = course["images"][0]["image"]
    image = httpx.get(image_url)
    # covers are re-encoded as WebP, without the uploaded file's metadata
    assert image.status_code == 200 and image.headers["content-type"] == "image/webp"

    detail = Browser().api("GET", f"/courses/{course['id']}/", token=None)
    assert detail.status_code == 200
    assert [lesson["title"] for lesson in detail.json()["stages"][0]["lessons"]] == ["Intro video", "Reading"]

    blocks = detail.json()["stages"][0]["lessons"][1]["blocks"]
    assert [block["type"] for block in blocks] == ["text", "link", "callout", "quiz"]
    assert detail.json()["is_owner"] is False and ada.api("GET", f"/courses/{course['id']}/").json()["is_owner"] is True

    # the author edits in place: lesson ids stay, a lesson moves, a block is added; nobody else can edit
    stages = ada.api("GET", f"/courses/{course['id']}/").json()["stages"]
    intro, reading = stages[0]["lessons"]
    edit = {
        "title": "E2E course, edited",
        "description": COURSE["description"],
        "status": "published",  # an edit replaces the whole course, its visibility included
        "kept_images": [],
        "stages": [{
            "id": stages[0]["id"], "title": "Basics", "order": 1,
            "lessons": [
                {**reading, "order": 1},
                {**intro, "order": 2, "blocks": [*intro["blocks"], {"type": "text", "text": "Added later."}]},
            ],
        }],
    }
    assert bob.api("PUT", f"/courses/{course['id']}/", json=edit).status_code == 404
    edited = ada.api("PUT", f"/courses/{course['id']}/", json=edit)
    assert edited.status_code == 200, edited.text
    lessons = edited.json()["stages"][0]["lessons"]
    assert [lesson["id"] for lesson in lessons] == [reading["id"], intro["id"]]
    assert lessons[1]["blocks"][-1]["text"] == "Added later." and edited.json()["images"] == []
    assert httpx.get(image_url).status_code == 404  # the cover left out of kept_images is gone

    # everyone browses the catalogue; "mine" is each account's own courses
    assert course["id"] in [c["id"] for c in bob.api("GET", "/courses/?limit=50").json()["results"]]
    assert [c["id"] for c in ada.api("GET", "/courses/?limit=50&mine=true").json()["results"]] == [course["id"]]
    assert bob.api("GET", "/courses/?limit=50&mine=true").json()["count"] == 0

    # nobody deletes someone else's course; bad and missing tokens are refused
    assert bob.api("DELETE", f"/courses/{course['id']}/delete/").status_code == 404
    tampered = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
    assert ada.api("DELETE", f"/courses/{course['id']}/delete/", token=tampered).status_code == 401
    assert ada.api("POST", "/courses/create/", token=None, json=COURSE).status_code == 401

    # server-side validation reaches the client as a readable message
    invalid = ada.api("POST", "/courses/create/", json={**COURSE, "title": "  "})
    assert invalid.status_code == 400 and invalid.json()["detail"] == "title: This field may not be blank."

    # deleting removes the course
    assert ada.api("DELETE", f"/courses/{course['id']}/delete/").status_code == 204
    assert Browser().api("GET", f"/courses/{course['id']}/", token=None).status_code == 404

    # two-factor: the wrong password can't turn it on; it is only on after a code from the app
    assert ada.auth("two-factor/enable", {"password": "wrong-password"}).status_code in (400, 401)
    setup = ada.auth("two-factor/enable", {"password": PASSWORD})
    assert setup.status_code == 200, setup.text
    totp_uri, backup_codes = setup.json()["totpURI"], setup.json()["backupCodes"]
    assert totp_uri.startswith("otpauth://totp/EduHub") and len(backup_codes) == 10
    assert ada.auth("get-session").json()["user"]["twoFactorEnabled"] is False
    wrong_code = "000000" if totp(totp_uri) != "000000" else "111111"
    assert ada.auth("two-factor/verify-totp", {"code": wrong_code}).status_code != 200
    assert ada.auth("two-factor/verify-totp", {"code": totp(totp_uri)}).status_code == 200
    assert ada.auth("get-session").json()["user"]["twoFactorEnabled"] is True

    # signing out ends the session: no more API tokens
    assert ada.auth("sign-out", {}).status_code == 200
    assert ada.auth("get-session").json() is None
    assert ada.api_token() is None

    # the password alone now gives a challenge, not a session
    assert Browser().auth("sign-in/email", {"email": ada.email, "password": "wrong-password"}).status_code == 401
    again = Browser()
    first_step = again.auth("sign-in/email", {"email": ada.email, "password": PASSWORD})
    assert first_step.status_code == 200 and first_step.json()["twoFactorRedirect"] is True
    assert again.api_token() is None
    assert again.auth("two-factor/verify-totp", {"code": totp(totp_uri)}).status_code == 200
    assert again.api_token() is not None

    # a backup code works once
    with_backup = Browser()
    with_backup.auth("sign-in/email", {"email": ada.email, "password": PASSWORD})
    assert with_backup.auth("two-factor/verify-backup-code", {"code": backup_codes[0]}).status_code == 200
    reuse = Browser()
    reuse.auth("sign-in/email", {"email": ada.email, "password": PASSWORD})
    assert reuse.auth("two-factor/verify-backup-code", {"code": backup_codes[0]}).status_code != 200

    # turning it off brings back password-only sign-in
    assert again.auth("two-factor/disable", {"password": PASSWORD}).status_code == 200
    plain = Browser()
    assert "twoFactorRedirect" not in plain.auth("sign-in/email", {"email": ada.email, "password": PASSWORD}).json()
    assert plain.api_token() is not None


def test_forgot_password_resets_it_and_signs_out_everywhere():
    person = sign_up("E2E Forgetful")
    assert person.api_token() is not None

    # unknown addresses get the same answer and no email, so accounts can't be looked up
    stranger = new_email("nobody")
    assert Browser().auth("request-password-reset", {"email": stranger, "redirectTo": "/reset-password"}).status_code == 200
    time.sleep(1)
    assert httpx.get(f"{MAILPIT}/api/v1/search", params={"query": f'to:"{stranger}"'}).json()["messages"] == []

    asked = Browser().auth("request-password-reset", {"email": person.email, "redirectTo": "/reset-password"})
    assert asked.status_code == 200
    link = next(url for url in emailed_links(person.email, count=2) if "/reset-password/" in url)

    # the emailed link checks the token and forwards to the app's page with it
    landing = Browser().http.get(link)
    assert landing.status_code == 302
    target = urlparse(landing.headers["location"])
    assert target.path == "/reset-password"
    token = parse_qs(target.query)["token"][0]

    new_password = PASSWORD + "-new"
    assert Browser().auth("reset-password", {"newPassword": "short", "token": token}).status_code == 400
    assert Browser().auth("reset-password", {"newPassword": new_password, "token": token}).status_code == 200
    assert Browser().auth("reset-password", {"newPassword": new_password, "token": token}).status_code == 400  # used once

    # the old session is gone; only the new password works
    assert person.auth("get-session").json() is None
    assert Browser().auth("sign-in/email", {"email": person.email, "password": PASSWORD}).status_code == 401
    fresh = Browser()
    assert fresh.auth("sign-in/email", {"email": person.email, "password": new_password}).status_code == 200
    assert fresh.api_token() is not None

    # a made-up token lands on the page with an error instead of a token
    forged = Browser().http.get(f"{FRONTEND}/api/auth/reset-password/forged?callbackURL=/reset-password")
    assert parse_qs(urlparse(forged.headers["location"]).query) == {"error": ["INVALID_TOKEN"]}
