"""Reviews, lesson comments, reports and moderation."""
import pytest

from app.config import get_settings
from tests.test_course_content import course, create, lesson, stage


@pytest.fixture
def published(client, auth):
    detail = create(client, auth(sub="ada", name="Ada Author"), course(stage("S", lesson("L"))))
    return detail["id"], detail["stages"][0]["lessons"][0]["id"]


def finish_lesson(client, auth, course_id, lesson_id, sub):
    url = f"/api/courses/{course_id}/lessons/{lesson_id}/progress/"
    assert client.put(url, json={"completed": True}, headers=auth(sub=sub)).status_code == 200


def test_only_learners_who_finished_a_lesson_can_review(client, auth, published):
    course_id, lesson_id = published
    url = f"/api/courses/{course_id}/reviews/"
    assert client.put(url, json={"rating": 5}, headers=auth(sub="bob")).status_code == 403
    assert client.put(url, json={"rating": 5}, headers=auth(sub="ada")).status_code == 400  # the author

    finish_lesson(client, auth, course_id, lesson_id, "bob")
    saved = client.put(url, json={"rating": 4, "text": " Clear and short. "}, headers=auth(sub="bob"))
    assert saved.status_code == 200 and saved.json()["text"] == "Clear and short."
    # saving again replaces the review
    assert client.put(url, json={"rating": 5}, headers=auth(sub="bob")).json()["rating"] == 5

    page = client.get(url).json()
    assert page["count"] == 1 and page["distribution"]["5"] == 1
    assert client.get(f"/api/courses/{course_id}/").json()["rating"] == {"average": 5.0, "count": 1}
    assert client.get(f"/api/courses/{course_id}/", headers=auth(sub="bob")).json()["my_review_id"] == page["results"][0]["id"]

    for rating in (0, 6):
        assert client.put(url, json={"rating": rating}, headers=auth(sub="bob")).status_code == 400


def test_authors_reply_to_reviews_and_reviewers_delete_theirs(client, auth, published):
    course_id, lesson_id = published
    finish_lesson(client, auth, course_id, lesson_id, "bob")
    review = client.put(f"/api/courses/{course_id}/reviews/", json={"rating": 3, "text": "Ok"}, headers=auth(sub="bob")).json()

    reply_url = f"/api/reviews/{review['id']}/reply/"
    assert client.put(reply_url, json={"text": "Thanks!"}, headers=auth(sub="bob")).status_code == 404
    assert client.put(reply_url, json={"text": "Thanks!"}, headers=auth(sub="ada")).json()["author_reply"] == "Thanks!"

    assert client.delete(f"/api/courses/{course_id}/reviews/", headers=auth(sub="bob")).status_code == 204
    assert client.get(f"/api/courses/{course_id}/reviews/").json()["count"] == 0


def test_comments_threads_and_permissions(client, auth, published):
    course_id, lesson_id = published
    url = f"/api/courses/{course_id}/lessons/{lesson_id}/comments/"
    assert client.post(url, json={"body": "Hi"}).status_code == 401
    question = client.post(url, json={"body": " Why? "}, headers=auth(sub="bob")).json()
    assert question["body"] == "Why?" and question["can_edit"] is True

    answer = client.post(url, json={"body": "Because.", "parent_id": question["id"]}, headers=auth(sub="ada")).json()
    assert answer["is_course_author"] is True
    # replies are one level deep
    nested = client.post(url, json={"body": "x", "parent_id": answer["id"]}, headers=auth(sub="bob"))
    assert nested.status_code == 400

    thread = client.get(url).json()
    assert thread["count"] == 1 and [r["body"] for r in thread["results"][0]["replies"]] == ["Because."]

    edit = client.patch(f"/api/comments/{question['id']}/", json={"body": "Why so?"}, headers=auth(sub="bob")).json()
    assert edit["body"] == "Why so?" and edit["edited_at"]
    assert client.patch(f"/api/comments/{question['id']}/", json={"body": "x"}, headers=auth(sub="cat")).status_code == 403
    assert client.delete(f"/api/comments/{question['id']}/", headers=auth(sub="cat")).status_code == 403
    # the course's author may remove any comment on it; replies go too
    assert client.delete(f"/api/comments/{question['id']}/", headers=auth(sub="ada")).status_code == 204
    assert client.get(url).json()["count"] == 0


def test_drafts_take_no_comments_and_strangers_cant_see_them(client, auth):
    detail = create(client, auth(sub="ada"), course(stage("S", lesson("L")), status="draft"))
    url = f"/api/courses/{detail['id']}/lessons/{detail['stages'][0]['lessons'][0]['id']}/comments/"
    assert client.post(url, json={"body": "x"}, headers=auth(sub="ada")).status_code == 400
    assert client.get(url).status_code == 404


def test_three_reports_hide_a_comment_until_a_moderator_decides(client, auth, published, monkeypatch):
    course_id, lesson_id = published
    url = f"/api/courses/{course_id}/lessons/{lesson_id}/comments/"
    spam = client.post(url, json={"body": "Buy now"}, headers=auth(sub="spammer")).json()
    report = {"target_type": "comment", "target_id": spam["id"], "reason": "spam"}

    assert client.post("/api/reports/", json=report, headers=auth(sub="spammer")).status_code == 400  # own
    for sub in ("r1", "r1", "r2"):
        assert client.post("/api/reports/", json=report, headers=auth(sub=sub)).status_code == 204
    assert client.get(url).json()["count"] == 1  # two distinct reporters so far
    client.post("/api/reports/", json=report, headers=auth(sub="r3"))
    assert client.get(url).json()["count"] == 0

    assert client.get("/api/moderation/reports/", headers=auth(sub="mod")).status_code == 403
    monkeypatch.setattr(get_settings(), "admin_emails", "mod@example.test")
    queue = client.get("/api/moderation/reports/", headers=auth(sub="mod")).json()
    assert queue[0]["reports"] == 3 and queue[0]["preview"] == "Buy now" and queue[0]["is_hidden"] is True

    keep = client.post(f"/api/moderation/comment/{spam['id']}/", json={"action": "keep"}, headers=auth(sub="mod"))
    assert keep.status_code == 204 and client.get(url).json()["count"] == 1
    assert client.get("/api/moderation/reports/", headers=auth(sub="mod")).json() == []


def test_moderators_remove_a_reported_course(client, auth, published, monkeypatch):
    course_id, _ = published
    client.post("/api/reports/", json={"target_type": "course", "target_id": course_id, "reason": "copyright"},
                headers=auth(sub="r1"))
    monkeypatch.setattr(get_settings(), "admin_emails", "mod@example.test")
    client.post(f"/api/moderation/course/{course_id}/", json={"action": "remove"}, headers=auth(sub="mod"))
    assert client.get(f"/api/courses/{course_id}/").status_code == 404
