from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

from app.config import get_settings


def video(url):
    return {"type": "video", "url": url}


def course_payload(**overrides):
    payload = {
        "title": "New Course",
        "description": "What you will learn.",
        "stages": [
            {
                "title": "Stage 1",
                "order": 1,
                "lessons": [
                    {"title": "Lesson 2", "order": 2, "blocks": [video("https://youtu.be/aqz-KE-bpKQ")]},
                    {"title": "Lesson 1", "order": 1, "blocks": [video("https://www.youtube.com/watch?v=ysz5S6PUM-U")]},
                ],
            },
            {"title": "Stage 2", "order": 2, "lessons": [
                {"title": "Reading", "order": 1, "blocks": [{"type": "text", "text": "Read this."}]}
            ]},
        ],
        # published, so other people and guests see it; drafts have their own tests
        "status": "published",
    }
    return {**payload, **overrides}


def one_lesson_stage(*blocks):
    return {"title": "S", "order": 1, "lessons": [{"title": "L", "order": 1, "blocks": list(blocks)}]}


def png_bytes(size=(4, 4)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, "green").save(buffer, "PNG")
    return buffer.getvalue()


def create(client, headers, **overrides):
    response = client.post("/api/courses/create/", json=course_payload(**overrides), headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_returns_course_with_author_and_stages(client, auth):
    course = create(client, auth(sub="tess", name="Tess Author"))

    assert course["title"] == "New Course"
    assert course["author"] == {"id": course["author"]["id"], "name": "Tess Author", "headline": ""}
    assert [stage["title"] for stage in course["stages"]] == ["Stage 1", "Stage 2"]
    assert "email" not in course["author"]


def test_titles_are_trimmed(client, auth):
    course = create(client, auth(), title="  Spaced  ")
    assert course["title"] == "Spaced"


def test_detail_is_public_with_ordered_lessons(client, auth):
    course_id = create(client, auth())["id"]

    response = client.get(f"/api/courses/{course_id}/")
    assert response.status_code == 200
    lessons = response.json()["stages"][0]["lessons"]
    assert [lesson["title"] for lesson in lessons] == ["Lesson 1", "Lesson 2"]


def test_detail_of_missing_course_is_404(client):
    assert client.get("/api/courses/999/").status_code == 404


def test_list_paginates_the_whole_catalogue_and_mine_shows_only_own(client, auth):
    for i in range(6):
        create(client, auth(sub="tess"), title=f"Tess {i}")
    create(client, auth(sub="other"), title="Other author's course")

    first = client.get("/api/courses/?limit=5").json()
    assert first["count"] == 7
    assert len(first["results"]) == 5
    assert first["results"][0]["title"] == "Other author's course"  # newest first
    assert first["previous"] is None
    assert first["next"].endswith("/api/courses/?limit=5&offset=5")

    second = client.get("/api/courses/?limit=5&offset=5").json()
    assert len(second["results"]) == 2
    assert second["next"] is None

    signed_in = client.get("/api/courses/", headers=auth(sub="tess")).json()
    assert signed_in["count"] == 7

    own = client.get("/api/courses/?limit=50&mine=true", headers=auth(sub="tess")).json()
    assert own["count"] == 6
    assert all(course["title"].startswith("Tess") for course in own["results"])
    assert client.get("/api/courses/?mine=true").status_code == 401


@pytest.mark.parametrize("query", ["limit=0", "limit=51", "offset=-1", "limit=abc"])
def test_bad_pagination_is_400(client, query):
    assert client.get(f"/api/courses/?{query}").status_code == 400


def test_author_deletes_own_course_but_not_others(client, auth):
    mine = create(client, auth(sub="tess"))["id"]
    theirs = create(client, auth(sub="other"))["id"]

    assert client.delete(f"/api/courses/{theirs}/delete/", headers=auth(sub="tess")).status_code == 404
    assert client.delete(f"/api/courses/{mine}/delete/", headers=auth(sub="tess")).status_code == 204
    assert client.get(f"/api/courses/{mine}/").status_code == 404
    assert client.get(f"/api/courses/{theirs}/").status_code == 200


@pytest.mark.parametrize(
    "overrides, expected",
    [
        ({"title": "   "}, "title: This field may not be blank."),
        ({"title": "x" * 101}, "title: Must be 100 characters or fewer."),
        ({"description": "x" * 5001}, "description: Must be 5000 characters or fewer."),
        ({"stages": []}, "Add at least one stage."),
        ({"stages": [{"title": "S", "order": 1, "lessons": []}]}, "Every stage needs at least one lesson."),
        ({"stages": [one_lesson_stage(video("https://example.com/v.mp4"))]}, "Use a YouTube or Vimeo link."),
        ({"stages": [one_lesson_stage(video("javascript:alert(1)"))]}, "Use a YouTube or Vimeo link."),
        ({"stages": [{"title": "A", "order": 1, "lessons": [{"title": "L", "order": 1}]},
                     {"title": "B", "order": 1, "lessons": [{"title": "L", "order": 1}]}]}, "Stage orders must be unique."),
        ({"stages": [{"title": "A", "order": 1, "lessons": [{"title": "L", "order": 1}, {"title": "M", "order": 1}]}]},
         "Lesson orders must be unique."),
        ({"stages": [{"title": "A", "order": 101, "lessons": [{"title": "L", "order": 1}]}]}, "less than or equal to 100"),
        ({"title": None}, "title:"),
    ],
)
def test_invalid_course_is_rejected_with_readable_error(client, auth, overrides, expected):
    response = client.post("/api/courses/create/", json=course_payload(**overrides), headers=auth())

    assert response.status_code == 400
    assert expected in response.json()["detail"]


def test_unsupported_body_is_rejected(client, auth):
    as_json = {**auth(), "Content-Type": "application/json"}
    as_text = {**auth(), "Content-Type": "text/plain"}
    assert client.post("/api/courses/create/", content=b"{not json", headers=as_json).status_code == 400
    assert client.post("/api/courses/create/", content=b"x", headers=as_text).status_code == 415


def multipart(payload, files):
    import json

    data = {"title": payload["title"], "description": payload["description"], "stages": json.dumps(payload["stages"]),
            "status": payload.get("status", "draft")}
    return {"data": data, "files": [("uploaded_images", file) for file in files]}


def test_multipart_upload_stores_and_serves_images(client, auth):
    request = multipart(course_payload(), [("photo.png", png_bytes(), "image/png"), ("evil.html", png_bytes(), "text/html")])
    response = client.post("/api/courses/create/", headers=auth(), **request)

    assert response.status_code == 201, response.text
    images = response.json()["images"]
    assert len(images) == 2
    for image in images:
        path = image["image"].split("/media/", 1)[1]
        # re-encoded as WebP under a random name, never the uploaded name or type; with a smaller copy for cards
        assert path.startswith("course_previews/") and path.endswith(".webp")
        assert image["thumbnail"].endswith("_thumb.webp")
        for url in (f"/media/{path}", image["thumbnail"].split("testserver", 1)[1]):
            served = client.get(url)
            assert served.status_code == 200
            assert served.headers["content-type"] == "image/webp"


@pytest.mark.parametrize(
    "files, expected",
    [
        ([("notes.png", b"definitely not an image", "image/png")], "isn't a valid image"),
        ([("big.png", png_bytes() + b"0" * (5 * 1024 * 1024), "image/png")], "over 5 MB"),
        ([(f"{i}.png", png_bytes(), "image/png") for i in range(6)], "Choose up to 5 images"),
    ],
)
def test_bad_uploads_are_rejected_and_nothing_is_saved(client, auth, files, expected):
    upload_dir = Path(get_settings().media_root) / "course_previews"
    before = set(upload_dir.glob("*")) if upload_dir.exists() else set()

    response = client.post("/api/courses/create/", headers=auth(), **multipart(course_payload(), files))

    assert response.status_code == 400
    assert expected in response.json()["detail"]
    after = set(upload_dir.glob("*")) if upload_dir.exists() else set()
    assert after == before
    assert client.get("/api/courses/").json()["count"] == 0


def test_deleting_a_course_removes_its_uploaded_files(client, auth):
    files = [("a.png", png_bytes(), "image/png")]
    response = client.post("/api/courses/create/", headers=auth(), **multipart(course_payload(), files))
    course = response.json()
    stored = Path(get_settings().media_root) / course["images"][0]["image"].split("/media/", 1)[1]
    assert stored.exists()

    client.delete(f"/api/courses/{course['id']}/delete/", headers=auth())
    assert not stored.exists()
