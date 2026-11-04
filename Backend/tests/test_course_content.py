"""Lesson content blocks and editing a course (PUT /api/courses/{id}/)."""
import json
from pathlib import Path

import pytest

from app.config import get_settings
from tests.test_courses import multipart, png_bytes

QUIZ = {
    "type": "quiz",
    "id": "q1",
    "question": "Which are fruits?",
    "options": [{"id": "a", "text": "Apple", "correct": True}, {"id": "b", "text": "Carrot"}],
    "explanation": "Apples grow on trees.",
}
ALL_BLOCKS = [
    {"type": "text", "id": "t1", "text": "## Welcome\n\nSome **markdown**."},
    {"type": "video", "id": "v1", "url": "https://youtu.be/aqz-KE-bpKQ", "caption": "Intro"},
    {"type": "link", "id": "l1", "url": "https://docs.python.org/3/", "title": "Python docs"},
    {"type": "callout", "id": "c1", "tone": "tip", "text": "Take notes."},
    QUIZ,
]


def course(*stages, title="Course"):
    return {"title": title, "description": "About it.", "stages": list(stages)}


def stage(title, *lessons, order=1, id=None):
    return {"id": id, "title": title, "order": order, "lessons": list(lessons)}


def lesson(title, order=1, blocks=(), id=None):
    return {"id": id, "title": title, "order": order, "blocks": list(blocks)}


def create(client, headers, body):
    response = client.post("/api/courses/create/", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return client.get(f"/api/courses/{response.json()['id']}/", headers=headers).json()


def test_every_block_type_round_trips(client, auth):
    detail = create(client, auth(), course(stage("S", lesson("L", blocks=ALL_BLOCKS))))

    blocks = detail["stages"][0]["lessons"][0]["blocks"]
    assert [block["type"] for block in blocks] == ["text", "video", "link", "callout", "quiz"]
    assert blocks[2]["description"] == "" and blocks[4]["options"][1]["correct"] is False
    assert detail["is_owner"] is True


def test_lessons_may_be_empty_and_missing_ids_are_generated(client, auth):
    body = course(stage("Outline", lesson("Later"), lesson("Now", 2, [{"type": "text", "text": "x"}])))
    detail = create(client, auth(), body)
    later, now = detail["stages"][0]["lessons"]
    assert later["blocks"] == []
    assert len(now["blocks"][0]["id"]) == 32


def test_is_owner_only_for_the_author(client, auth):
    course_id = create(client, auth(sub="ada"), course(stage("S", lesson("L"))))["id"]
    assert client.get(f"/api/courses/{course_id}/", headers=auth(sub="bob")).json()["is_owner"] is False
    assert client.get(f"/api/courses/{course_id}/").json()["is_owner"] is False


def quiz(**changes):
    return {**QUIZ, **changes}


@pytest.mark.parametrize(
    "block, expected",
    [
        ({"type": "text", "text": "   "}, "may not be blank"),
        ({"type": "text", "text": "x" * 20001}, "20000 characters or fewer"),
        ({"type": "video", "url": ""}, "Add a YouTube link."),
        ({"type": "link", "url": "javascript:alert(1)", "title": "x"}, "starting with https://"),
        ({"type": "link", "url": "https://example.com", "title": ""}, "may not be blank"),
        ({"type": "callout", "tone": "danger", "text": "x"}, "'info', 'tip' or 'warning'"),
        ({"type": "embed", "html": "<script>"}, "does not match any of the expected tags"),
        (quiz(options=[{"text": "Only one", "correct": True}]), "2 to 8 answers"),
        (quiz(options=[{"text": "A"}, {"text": "B"}]), "Mark at least one answer as correct."),
        (quiz(options=[{"id": "a", "text": "A", "correct": True}, {"id": "a", "text": "B"}]), "Answer ids must be unique."),
        ({"type": "text", "id": "bad id!", "text": "x"}, "should match pattern"),
    ],
)
def test_invalid_blocks_are_rejected(client, auth, block, expected):
    response = client.post("/api/courses/create/", json=course(stage("S", lesson("L", blocks=[block]))), headers=auth())
    assert response.status_code == 400
    assert expected in response.json()["detail"], response.json()


def test_block_limits(client, auth):
    too_many = [{"type": "text", "text": "x"}] * 51
    response = client.post("/api/courses/create/", json=course(stage("S", lesson("L", blocks=too_many))), headers=auth())
    assert response.status_code == 400

    twice = [{"type": "text", "id": "same", "text": "a"}, {"type": "text", "id": "same", "text": "b"}]
    response = client.post("/api/courses/create/", json=course(stage("S", lesson("L", blocks=twice))), headers=auth())
    assert "Block ids must be unique." in response.json()["detail"]


def update(client, headers, course_id, body):
    return client.put(f"/api/courses/{course_id}/", json=body, headers=headers)


def test_edit_keeps_ids_moves_reorders_and_deletes(client, auth):
    original = create(client, auth(), course(
        stage("One", lesson("A"), lesson("B", 2), order=1),
        stage("Two", lesson("C"), order=2),
    ))
    one, two = original["stages"]
    a, b = one["lessons"]
    c = two["lessons"][0]

    # swap the stages, move A into Two ahead of C, drop B, add D
    body = course(
        stage("Two renamed", lesson("A", 1, id=a["id"]), lesson("C", 2, [QUIZ], id=c["id"]), order=1, id=two["id"]),
        stage("One", lesson("D"), order=2, id=one["id"]),
        title="Renamed",
    )
    response = update(client, auth(), original["id"], body)
    assert response.status_code == 200, response.text
    edited = response.json()

    assert edited["title"] == "Renamed"
    assert [s["id"] for s in edited["stages"]] == [two["id"], one["id"]]
    assert [s["title"] for s in edited["stages"]] == ["Two renamed", "One"]
    first_lessons = edited["stages"][0]["lessons"]
    assert [lesson_["id"] for lesson_ in first_lessons] == [a["id"], c["id"]]
    assert first_lessons[1]["blocks"][0]["question"] == "Which are fruits?"
    d = edited["stages"][1]["lessons"][0]
    assert d["title"] == "D" and d["id"] not in (a["id"], b["id"], c["id"])
    assert b["id"] not in [lesson_["id"] for s in edited["stages"] for lesson_ in s["lessons"]]


def test_edit_is_for_the_author_only(client, auth):
    original = create(client, auth(sub="ada"), course(stage("S", lesson("L"))))
    body = course(stage("Hijacked", lesson("L")))

    assert update(client, auth(sub="bob"), original["id"], body).status_code == 404
    assert client.put(f"/api/courses/{original['id']}/", json=body).status_code == 401
    assert client.get(f"/api/courses/{original['id']}/").json()["stages"][0]["title"] == "S"


def test_edit_cannot_adopt_rows_of_another_course(client, auth):
    mine = create(client, auth(sub="ada"), course(stage("Mine", lesson("L"))))
    theirs = create(client, auth(sub="bob"), course(stage("Theirs", lesson("Secret"))))
    their_stage = theirs["stages"][0]
    their_lesson = their_stage["lessons"][0]

    for body in (
        course(stage("Grab", lesson("L"), id=their_stage["id"])),
        course(stage("Mine", lesson("Grab", id=their_lesson["id"]))),
    ):
        response = update(client, auth(sub="ada"), mine["id"], body)
        assert response.status_code == 400
        assert "isn't part of this course" in response.json()["detail"]

    assert client.get(f"/api/courses/{theirs['id']}/").json()["stages"][0]["lessons"][0]["title"] == "Secret"


def test_edit_rejects_duplicate_ids(client, auth):
    original = create(client, auth(), course(stage("S", lesson("A"))))
    lesson_id = original["stages"][0]["lessons"][0]["id"]
    body = course(stage("S", lesson("A", 1, id=lesson_id), lesson("A again", 2, id=lesson_id)))
    assert "Lesson ids must be unique." in update(client, auth(), original["id"], body).json()["detail"]


def stored_path(image):
    return Path(get_settings().media_root) / image["image"].split("/media/", 1)[1]


def test_edit_keeps_removes_and_adds_images(client, auth):
    files = [("a.png", png_bytes(), "image/png"), ("b.png", png_bytes(), "image/png")]
    created = client.post("/api/courses/create/", headers=auth(), **multipart(course(stage("S", lesson("L"))), files)).json()
    keep, drop = created["images"]

    # JSON without kept_images leaves the images alone
    assert len(update(client, auth(), created["id"], course(stage("S", lesson("L")))).json()["images"]) == 2

    request = multipart(course(stage("S", lesson("L"))), [("c.png", png_bytes(), "image/png")])
    request["data"]["kept_images"] = json.dumps([keep["id"]])
    response = client.put(f"/api/courses/{created['id']}/", headers=auth(), **request)
    assert response.status_code == 200, response.text
    images = response.json()["images"]

    assert [image["id"] for image in images][0] == keep["id"] and len(images) == 2
    assert stored_path(keep).exists() and stored_path(images[1]).exists()
    assert not stored_path(drop).exists()


def test_edit_refuses_more_than_five_images_and_saves_nothing(client, auth):
    files = [(f"{i}.png", png_bytes(), "image/png") for i in range(4)]
    created = client.post("/api/courses/create/", headers=auth(), **multipart(course(stage("S", lesson("L"))), files)).json()

    request = multipart(course(stage("S", lesson("L"))), [(f"n{i}.png", png_bytes(), "image/png") for i in range(2)])
    response = client.put(f"/api/courses/{created['id']}/", headers=auth(), **request)

    assert response.status_code == 400 and "Choose up to 5 images" in response.json()["detail"]
    assert len(client.get(f"/api/courses/{created['id']}/").json()["images"]) == 4
