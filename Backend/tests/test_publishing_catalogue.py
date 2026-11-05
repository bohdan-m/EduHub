"""Draft/published/unlisted courses, course details, catalogue search and sorting, duplicating, related courses."""
import pytest

from tests.test_course_content import TEXT, course, create, lesson, stage


def make(client, headers, title="Course", status="published", **details):
    return create(client, headers, {**course(stage("S", lesson("L")), title=title, status=status), **details})


def test_new_courses_are_drafts_only_their_author_sees(client, auth):
    body = {**course(stage("S", lesson("L"))), "status": None}
    body.pop("status")
    draft = create(client, auth(sub="ada"), body)
    assert draft["status"] == "draft" and draft["published_at"] is None

    url = f"/api/courses/{draft['id']}/"
    assert client.get(url).status_code == 404
    assert client.get(url, headers=auth(sub="bob")).status_code == 404
    assert client.get(url, headers=auth(sub="ada")).json()["is_owner"] is True
    assert client.get("/api/courses/").json()["count"] == 0
    assert client.get("/api/courses/?mine=true", headers=auth(sub="ada")).json()["count"] == 1


def test_unlisted_courses_open_by_link_but_stay_out_of_the_catalogue(client, auth):
    unlisted = make(client, auth(sub="ada"), status="unlisted")
    assert client.get(f"/api/courses/{unlisted['id']}/").status_code == 200
    assert client.get("/api/courses/").json()["count"] == 0


def test_publishing_needs_content_in_every_lesson(client, auth):
    body = course(stage("S", lesson("Empty", blocks=())))
    response = client.post("/api/courses/create/", json=body, headers=auth())
    assert response.status_code == 400 and "needs some content" in response.json()["detail"]

    draft = create(client, auth(), {**body, "status": "draft"})
    status_url = f"/api/courses/{draft['id']}/status/"
    assert client.post(status_url, json={"status": "published"}, headers=auth()).status_code == 400
    assert client.post(status_url, json={"status": "published"}, headers=auth(sub="bob")).status_code == 404


def test_status_endpoint_publishes_and_sets_published_at_once(client, auth):
    draft = make(client, auth(), status="draft")
    published = client.post(f"/api/courses/{draft['id']}/status/", json={"status": "published"}, headers=auth()).json()
    assert published["status"] == "published" and published["published_at"]
    back = client.post(f"/api/courses/{draft['id']}/status/", json={"status": "draft"}, headers=auth()).json()
    assert back["published_at"] == published["published_at"]


def test_details_are_saved_and_lists_cleaned(client, auth):
    detail = make(
        client, auth(), category="data", level="beginner", language="uk",
        outcomes=["  Write SELECT queries ", "", "Join tables"], requirements=["A laptop"],
        intro_video_url="https://vimeo.com/76979871",
    )
    full = client.get(f"/api/courses/{detail['id']}/").json()
    assert (full["category"], full["level"], full["language"]) == ("data", "beginner", "uk")
    assert full["outcomes"] == ["Write SELECT queries", "Join tables"]
    assert full["requirements"] == ["A laptop"]
    assert full["intro_video_url"] == "https://vimeo.com/76979871"
    assert full["lesson_count"] == 1 and full["estimated_minutes"] >= 1


@pytest.mark.parametrize("field, value", [
    ("category", "cooking"), ("level", "expert"), ("status", "secret"), ("outcomes", ["x"] * 11),
    ("intro_video_url", "https://example.com/v.mp4"),
])
def test_invalid_details_are_rejected(client, auth, field, value):
    body = {**course(stage("S", lesson("L"))), field: value}
    assert client.post("/api/courses/create/", json=body, headers=auth()).status_code == 400


def test_estimated_minutes_count_reading_and_videos(client, auth):
    long_text = {"type": "text", "text": "word " * 1000}  # 5 minutes of reading
    video = {"type": "video", "url": "https://youtu.be/aqz-KE-bpKQ"}  # counted as 6
    detail = create(client, auth(), course(stage("S", lesson("L", blocks=[long_text, video]))))
    assert detail["estimated_minutes"] == 11


def test_catalogue_search_filters_and_escapes_wildcards(client, auth):
    make(client, auth(), title="SQL for analysts", category="data", level="beginner")
    make(client, auth(), title="Brand design", category="design", level="advanced")
    make(client, auth(), title="100% CSS", category="design")

    def titles(query):
        return [c["title"] for c in client.get(f"/api/courses/?{query}").json()["results"]]

    assert titles("q=sql") == ["SQL for analysts"]
    assert titles("q=about") != []  # descriptions are searched too
    assert sorted(titles("category=design")) == ["100% CSS", "Brand design"]
    assert titles("category=design&level=advanced") == ["Brand design"]
    assert titles("q=%25") == ["100% CSS"]  # a literal %, not "anything"
    assert client.get("/api/courses/?category=cooking").status_code == 400


def test_catalogue_sorts_by_learners_and_rating(client, auth):
    quiet = make(client, auth(sub="ada"), title="Quiet")
    busy = make(client, auth(sub="ada"), title="Busy")
    for learner in ("l1", "l2"):
        client.post(f"/api/courses/{busy['id']}/enroll/", headers=auth(sub=learner))
    assert [c["title"] for c in client.get("/api/courses/?sort=popular").json()["results"]] == ["Busy", "Quiet"]

    lesson_id = client.get(f"/api/courses/{quiet['id']}/").json()["stages"][0]["lessons"][0]["id"]
    client.put(f"/api/courses/{quiet['id']}/lessons/{lesson_id}/progress/", json={"completed": True}, headers=auth(sub="l1"))
    client.put(f"/api/courses/{quiet['id']}/reviews/", json={"rating": 5}, headers=auth(sub="l1"))
    results = client.get("/api/courses/?sort=rating").json()["results"]
    assert results[0]["title"] == "Quiet" and results[0]["rating"] == {"average": 5.0, "count": 1}
    assert results[1]["learner_count"] == 2


def test_duplicate_makes_a_private_draft_copy(client, auth):
    source = make(client, auth(sub="ada"), title="Original", outcomes=["One"])
    copy = client.post(f"/api/courses/{source['id']}/duplicate/", headers=auth(sub="ada"))
    assert copy.status_code == 201
    copy = copy.json()
    assert copy["title"] == "Copy of Original" and copy["status"] == "draft" and copy["id"] != source["id"]
    full = client.get(f"/api/courses/{copy['id']}/", headers=auth(sub="ada")).json()
    assert full["outcomes"] == ["One"] and full["stages"][0]["lessons"][0]["blocks"][0]["text"] == TEXT["text"]
    assert client.post(f"/api/courses/{source['id']}/duplicate/", headers=auth(sub="bob")).status_code == 404


def test_related_courses_share_the_category(client, auth):
    first = make(client, auth(), title="A", category="data")
    make(client, auth(), title="B", category="data")
    make(client, auth(), title="C", category="design")
    make(client, auth(), title="D", category="data", status="draft")
    assert [c["title"] for c in client.get(f"/api/courses/{first['id']}/related/").json()] == ["B"]
