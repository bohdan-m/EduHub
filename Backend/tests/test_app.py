from sqlalchemy import func, select

from app.models import Course, User
from app.seed import get_course_data, seed


def test_health(client):
    for path in ("/", "/api/health/"):
        response = client.get(path)
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


def test_security_headers(client):
    headers = client.get("/api/health/").headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"
    assert "default-src 'none'" in headers["content-security-policy"]


def test_cors_allows_only_the_frontend(client):
    preflight = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization"}
    allowed = client.options("/api/courses/", headers={"Origin": "http://localhost:5173", **preflight})
    blocked = client.options("/api/courses/", headers={"Origin": "http://evil.test", **preflight})

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in blocked.headers


def test_unknown_host_is_rejected(client):
    assert client.get("/api/health/", headers={"Host": "evil.test"}).status_code == 400


def test_seed_creates_demo_courses_without_users(client, db):
    assert seed(db) == len(get_course_data())
    assert seed(db) == 0  # second run is a no-op

    assert db.scalar(select(func.count()).select_from(User)) == 0
    assert db.scalar(select(func.count()).select_from(Course).where(Course.author_id.is_not(None))) == 0

    course = client.get("/api/courses/").json()["results"][0]
    assert course["author"] is None
    assert course["images"][0]["image"].startswith("http://testserver/media/")
