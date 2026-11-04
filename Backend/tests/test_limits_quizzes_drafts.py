"""Server-side quiz grading, course drafts, rate limits and body size caps."""
import pytest

from app import limits
from tests.test_course_content import QUIZ, course, create, lesson, stage


def quiz_course(client, headers, quiz=QUIZ):
    return create(client, headers, course(stage("S", lesson("L", blocks=[{"type": "text", "id": "t", "text": "x"}, quiz]))))


def check_url(detail, block_id="q1"):
    lesson_id = detail["stages"][0]["lessons"][0]["id"]
    return f"/api/courses/{detail['id']}/lessons/{lesson_id}/quizzes/{block_id}/check/"


def test_learners_get_quizzes_without_answers(client, auth):
    owner_view = quiz_course(client, auth(sub="ada"))
    assert owner_view["stages"][0]["lessons"][0]["blocks"][1]["options"][0]["correct"] is True

    for headers in ({}, auth(sub="bob")):
        quiz = client.get(f"/api/courses/{owner_view['id']}/", headers=headers).json()["stages"][0]["lessons"][0]["blocks"][1]
        assert quiz == {
            "type": "quiz", "id": "q1", "question": "Which are fruits?", "multiple": False,
            "options": [{"id": "a", "text": "Apple"}, {"id": "b", "text": "Carrot"}],
        }


def test_quiz_is_graded_on_the_server(client, auth):
    multi = {**QUIZ, "options": [*QUIZ["options"], {"id": "c", "text": "Pear", "correct": True}]}
    detail = quiz_course(client, auth(sub="ada"), multi)
    url = check_url(detail)

    right = client.post(url, json={"selected": ["c", "a"]}).json()
    assert right == {"correct": True, "correct_option_ids": ["a", "c"], "explanation": "Apples grow on trees."}
    assert client.post(url, json={"selected": ["a"]}).json()["correct"] is False  # one missing
    assert client.post(url, json={"selected": ["a", "b", "c"]}).json()["correct"] is False  # one extra
    assert client.get(f"/api/courses/{detail['id']}/").json()["stages"][0]["lessons"][0]["blocks"][1]["multiple"] is True


def test_quiz_check_404s_for_unknown_or_mismatched_ids(client, auth):
    detail = quiz_course(client, auth(sub="ada"))
    other = quiz_course(client, auth(sub="bob"))
    lesson_id = detail["stages"][0]["lessons"][0]["id"]

    assert client.post(check_url(detail, "nope"), json={"selected": []}).status_code == 404
    assert client.post(check_url(detail, "t"), json={"selected": []}).status_code == 404  # a text block isn't a quiz
    wrong_course = f"/api/courses/{other['id']}/lessons/{lesson_id}/quizzes/q1/check/"
    assert client.post(wrong_course, json={"selected": []}).status_code == 404
    assert client.post(check_url(detail), json={"selected": ["x"] * 9}).status_code == 400


def test_drafts_round_trip_per_user_and_course(client, auth):
    data = {"title": "Half done", "stages": [{"key": "s1", "lessons": []}]}
    assert client.get("/api/drafts/", headers=auth(sub="ada")).status_code == 404

    saved = client.put("/api/drafts/", json={"data": data}, headers=auth(sub="ada"))
    assert saved.status_code == 200 and saved.json()["course_id"] is None
    # saving again replaces the one "new course" draft instead of adding another
    client.put("/api/drafts/", json={"data": {**data, "title": "More done"}}, headers=auth(sub="ada"))
    assert client.get("/api/drafts/", headers=auth(sub="ada")).json()["data"]["title"] == "More done"
    assert client.get("/api/drafts/", headers=auth(sub="bob")).status_code == 404

    course_id = quiz_course(client, auth(sub="ada"))["id"]
    client.put("/api/drafts/", json={"course_id": course_id, "data": data}, headers=auth(sub="ada"))
    assert client.get(f"/api/drafts/?course_id={course_id}", headers=auth(sub="ada")).json()["data"]["title"] == "Half done"

    assert client.delete("/api/drafts/", headers=auth(sub="ada")).status_code == 204
    assert client.get("/api/drafts/", headers=auth(sub="ada")).status_code == 404
    assert client.get(f"/api/drafts/?course_id={course_id}", headers=auth(sub="ada")).status_code == 200

    # deleting the course takes its draft with it
    client.delete(f"/api/courses/{course_id}/delete/", headers=auth(sub="ada"))
    assert client.get(f"/api/drafts/?course_id={course_id}", headers=auth(sub="ada")).status_code == 404


def test_drafts_are_private_to_the_courses_author(client, auth):
    course_id = quiz_course(client, auth(sub="ada"))["id"]
    response = client.put("/api/drafts/", json={"course_id": course_id, "data": {"title": "x"}}, headers=auth(sub="bob"))
    assert response.status_code == 404
    assert client.put("/api/drafts/", json={"data": {"title": "x"}}).status_code == 401
    assert client.put("/api/drafts/", json={"data": {}}, headers=auth(sub="ada")).status_code == 400


def test_course_writes_are_rate_limited_per_user(client, auth):
    body = course(stage("S", lesson("L")))
    for _ in range(30):
        assert client.post("/api/courses/create/", json=body, headers=auth(sub="ada")).status_code == 201

    limited = client.post("/api/courses/create/", json=body, headers=auth(sub="ada"))
    assert limited.status_code == 429
    assert 0 < int(limited.headers["retry-after"]) <= 60
    # someone else has their own allowance
    assert client.post("/api/courses/create/", json=body, headers=auth(sub="bob")).status_code == 201


def test_quiz_checks_by_guests_are_rate_limited_by_address(client, auth):
    url = check_url(quiz_course(client, auth(sub="ada")))
    codes = [client.post(url, json={"selected": ["a"]}).status_code for _ in range(121)]
    assert codes[:120] == [200] * 120 and codes[120] == 429


def test_oversized_json_is_refused(client, auth):
    huge = {"title": "T", "description": "x" * (limits.MAX_CONTENT_BYTES + 1), "stages": []}
    assert client.post("/api/courses/create/", json=huge, headers=auth()).status_code == 413


def test_oversized_chunked_body_without_content_length_is_refused(client, auth):
    # a streamed body has no Content-Length, so only counting the bytes as they arrive can stop it
    def chunks():
        yield b'{"title": "T", "description": "'
        for _ in range(6):
            yield b"x" * (1024 * 1024)
        yield b'", "stages": []}'

    headers = {**auth(), "Content-Type": "application/json"}
    response = client.put("/api/drafts/", content=chunks(), headers=headers)
    assert response.status_code == 413


@pytest.mark.parametrize("path", ["/api/courses/create/", "/api/drafts/"])
def test_declared_oversize_is_refused_before_reading(client, auth, path):
    headers = {**auth(), "Content-Type": "application/json", "Content-Length": str(limits.MAX_CONTENT_BYTES + 1)}
    assert client.post(path, content=b"{}", headers=headers).status_code == 413
