"""Profiles, author pages, data export, account removal, lesson uploads and the new block and quiz types."""
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

from app.config import get_settings
from tests.test_course_content import course, create, lesson, stage


def jpeg_with_gps() -> bytes:
    image = Image.new("RGB", (40, 20), "red")
    exif = Image.Exif()
    exif[0x8825] = {2: (50.0, 27.0, 0.0)}  # GPSInfo: a latitude
    exif[0x010F] = "PhoneMaker"  # camera make
    out = BytesIO()
    image.save(out, "JPEG", exif=exif)
    return out.getvalue()


def upload(client, headers, name, data, kind="image"):
    return client.post(f"/api/uploads/?kind={kind}", files={"file": (name, data)}, headers=headers)


def test_profile_and_public_author_page(client, auth):
    me = client.patch("/api/me/", json={"headline": "SQL teacher", "bio": "I teach."}, headers=auth(sub="ada")).json()
    assert me["headline"] == "SQL teacher" and me["is_admin"] is False
    create(client, auth(sub="ada"), course(stage("S", lesson("L")), title="Public"))
    create(client, auth(sub="ada"), course(stage("S", lesson("L")), title="Hidden draft", status="draft"))

    page = client.get(f"/api/users/{me['id']}/").json()
    assert page["headline"] == "SQL teacher" and [c["title"] for c in page["courses"]] == ["Public"]
    assert client.get("/api/courses/?author=" + str(me["id"])).json()["count"] == 1
    assert client.get("/api/users/999/").status_code == 404
    assert client.patch("/api/me/", json={"bio": "x" * 1001}, headers=auth(sub="ada")).status_code == 400


def test_export_includes_the_users_data(client, auth):
    create(client, auth(sub="ada"), course(stage("S", lesson("L")), title="Mine"))
    data = client.get("/api/me/export/", headers=auth(sub="ada")).json()
    assert data["profile"]["email"] == "ada@example.test"
    assert data["courses"][0]["title"] == "Mine" and data["courses"][0]["stages"][0]["lessons"][0]["blocks"]
    assert client.get("/api/me/export/").status_code == 401


def test_images_are_reencoded_without_metadata(client, auth):
    response = upload(client, auth(), "holiday.jpg", jpeg_with_gps())
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["path"].startswith("lesson_uploads/") and body["path"].endswith(".webp")
    stored = Path(get_settings().media_root) / body["path"]
    with Image.open(stored) as image:
        assert image.format == "WEBP" and not image.getexif()


@pytest.mark.parametrize("name, data, expected", [
    ("notes.pdf", b"not a pdf", "isn't a valid .pdf"),
    ("page.html", b"<script>", "Attach a PDF"),
    ("bin.txt", b"\xff\xfe\x00", "plain UTF-8"),
    ("empty.pdf", b"", "is empty"),
])
def test_bad_attachments_are_rejected(client, auth, name, data, expected):
    response = upload(client, auth(), name, data, kind="file")
    assert response.status_code == 400 and expected in response.json()["detail"]


def test_attachments_download_and_image_file_blocks_need_your_own_upload(client, auth):
    pdf = upload(client, auth(sub="ada"), "slides.pdf", b"%PDF-1.7 tiny", kind="file").json()
    served = client.get(f"/media/{pdf['path']}")
    assert served.status_code == 200 and served.headers["content-disposition"] == "attachment"

    image = upload(client, auth(sub="ada"), "a.png", jpeg_with_gps()).json()
    blocks = [
        {"type": "image", "path": image["path"], "alt": "A red square"},
        {"type": "file", "path": pdf["path"], "name": "slides.pdf", "size": pdf["size"]},
    ]
    detail = create(client, auth(sub="ada"), course(stage("S", lesson("L", blocks=blocks))))
    shown = client.get(f"/api/courses/{detail['id']}/").json()["stages"][0]["lessons"][0]["blocks"]
    assert shown[0]["url"].endswith(image["path"]) and shown[1]["url"].endswith(pdf["path"])

    stolen = client.post("/api/courses/create/", json=course(stage("S", lesson("L", blocks=blocks))),
                         headers=auth(sub="bob"))
    assert stolen.status_code == 400 and "isn't yours" in stolen.json()["detail"]


def test_short_answer_and_matching_quizzes(client, auth):
    short = {"type": "quiz", "id": "s", "kind": "short", "question": "Capital of France?", "answers": ["Paris"]}
    match = {"type": "quiz", "id": "m", "kind": "match", "question": "Match them",
             "pairs": [{"id": "p1", "left": "SELECT", "right": "read rows"},
                       {"id": "p2", "left": "DELETE", "right": "remove rows"}]}
    detail = create(client, auth(sub="ada"), course(stage("S", lesson("L", blocks=[short, match]))))
    lesson_id = detail["stages"][0]["lessons"][0]["id"]
    public = client.get(f"/api/courses/{detail['id']}/").json()["stages"][0]["lessons"][0]["blocks"]
    assert "answers" not in public[0]
    assert public[1]["rights"] == ["read rows", "remove rows"] and "pairs" not in public[1]

    base = f"/api/courses/{detail['id']}/lessons/{lesson_id}/quizzes"
    assert client.post(f"{base}/s/check/", json={"text": "  paris "}).json()["correct"] is True
    assert client.post(f"{base}/s/check/", json={"text": "Lyon"}).json()["accepted_answers"] == ["Paris"]
    right = {"p1": "read rows", "p2": "Remove Rows"}
    assert client.post(f"{base}/m/check/", json={"matches": right}).json()["correct"] is True
    wrong = client.post(f"{base}/m/check/", json={"matches": {"p1": "remove rows", "p2": "read rows"}}).json()
    assert wrong["correct"] is False and wrong["correct_matches"]["p1"] == "read rows"


@pytest.mark.parametrize("quiz", [
    {"kind": "short", "answers": []},
    {"kind": "match", "pairs": [{"left": "a", "right": "x"}]},
    {"kind": "match", "pairs": [{"left": "a", "right": "x"}, {"left": "b", "right": "X"}]},
])
def test_invalid_new_quizzes_are_rejected(client, auth, quiz):
    block = {"type": "quiz", "question": "Q", **quiz}
    response = client.post("/api/courses/create/", json=course(stage("S", lesson("L", blocks=[block]))), headers=auth())
    assert response.status_code == 400


def test_deleted_accounts_are_removed_only_with_the_internal_secret(client, auth, monkeypatch):
    create(client, auth(sub="gone"), course(stage("S", lesson("L"))))
    url = "/api/internal/users/gone/"
    assert client.delete(url, headers={"X-Internal-Secret": "x"}).status_code == 404  # no secret configured
    monkeypatch.setattr(get_settings(), "internal_api_secret", "s3cret")
    assert client.delete(url, headers={"X-Internal-Secret": "wrong"}).status_code == 404
    assert client.delete(url, headers={"X-Internal-Secret": "s3cret"}).status_code == 204
    assert client.get("/api/courses/").json()["count"] == 0
