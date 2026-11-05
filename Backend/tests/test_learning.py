"""Enrolling, progress, notes, bookmarks, quiz results, certificates, and the author's stats."""
from tests.test_course_content import QUIZ, course, create, lesson, stage


def two_lesson_course(client, headers, **extra):
    body = course(stage("S", lesson("One"), lesson("Two", 2, [QUIZ])), title="Learn it")
    return create(client, headers, {**body, **extra})


def lesson_ids(client, course_id, headers):
    detail = client.get(f"/api/courses/{course_id}/", headers=headers).json()
    return [lesson["id"] for stage in detail["stages"] for lesson in stage["lessons"]]


def progress(client, course_id, lesson_id, headers, **body):
    return client.put(f"/api/courses/{course_id}/lessons/{lesson_id}/progress/", json=body, headers=headers)


def test_enrolling_and_leaving(client, auth):
    course_id = two_lesson_course(client, auth(sub="ada"))["id"]
    enrolled = client.post(f"/api/courses/{course_id}/enroll/", headers=auth(sub="bob"))
    assert enrolled.status_code == 200 and enrolled.json()["completed_lesson_ids"] == []
    again = client.post(f"/api/courses/{course_id}/enroll/", headers=auth(sub="bob"))
    assert again.json()["enrolled_at"] == enrolled.json()["enrolled_at"]
    assert client.get(f"/api/courses/{course_id}/", headers=auth(sub="bob")).json()["learner_count"] == 1

    assert client.post(f"/api/courses/{course_id}/enroll/", headers=auth(sub="ada")).status_code == 400  # own course
    assert client.post(f"/api/courses/{course_id}/enroll/").status_code == 401
    assert client.delete(f"/api/courses/{course_id}/enroll/", headers=auth(sub="bob")).status_code == 204
    assert client.get(f"/api/courses/{course_id}/", headers=auth(sub="bob")).json()["enrollment"] is None


def test_drafts_cannot_be_enrolled_in(client, auth):
    course_id = two_lesson_course(client, auth(sub="ada"), status="draft")["id"]
    assert client.post(f"/api/courses/{course_id}/enroll/", headers=auth(sub="bob")).status_code == 404


def test_progress_resume_notes_bookmarks_and_certificate(client, auth):
    course_id = two_lesson_course(client, auth(sub="ada"))["id"]
    bob = auth(sub="bob", name="Bob Learner")
    first, second = lesson_ids(client, course_id, bob)

    # opening a lesson enrolls and remembers it
    saved = progress(client, course_id, first, bob, completed=True, note="  remember this ", bookmarked=True).json()
    assert saved["lesson"] == {"completed": True, "bookmarked": True, "note": "remember this"}
    assert saved["enrollment"]["last_lesson_id"] == first and saved["enrollment"]["completed_at"] is None
    # a later update leaves the other fields alone
    assert progress(client, course_id, first, bob, bookmarked=False).json()["lesson"]["note"] == "remember this"
    assert client.get(f"/api/courses/{course_id}/lessons/{first}/progress/", headers=bob).json()["completed"] is True

    done = progress(client, course_id, second, bob, completed=True).json()["enrollment"]
    assert set(done["completed_lesson_ids"]) == {first, second}
    assert done["completed_at"] and done["certificate_code"]

    certificate = client.get(f"/api/certificates/{done['certificate_code']}/").json()
    assert certificate["learner_name"] == "Bob Learner" and certificate["course_title"] == "Learn it"
    assert client.get("/api/certificates/not-a-code/").status_code == 404

    # undoing a lesson keeps the certificate earned
    again = progress(client, course_id, second, bob, completed=False).json()["enrollment"]
    assert again["certificate_code"] == done["certificate_code"]


def test_progress_rejects_lessons_of_other_courses_and_long_notes(client, auth):
    course_id = two_lesson_course(client, auth(sub="ada"))["id"]
    other_id = two_lesson_course(client, auth(sub="ada"))["id"]
    foreign = lesson_ids(client, other_id, auth(sub="bob"))[0]
    assert progress(client, course_id, foreign, auth(sub="bob"), completed=True).status_code == 404
    first = lesson_ids(client, course_id, auth(sub="bob"))[0]
    assert progress(client, course_id, first, auth(sub="bob"), note="x" * 5001).status_code == 400


def test_my_learning_lists_courses_and_bookmarks(client, auth):
    course_id = two_lesson_course(client, auth(sub="ada"))["id"]
    first, _ = lesson_ids(client, course_id, auth(sub="bob"))
    progress(client, course_id, first, auth(sub="bob"), completed=True, bookmarked=True, note="n")

    learning = client.get("/api/me/learning/", headers=auth(sub="bob")).json()
    item = learning["courses"][0]
    assert (item["course"]["id"], item["completed_lessons"], item["total_lessons"]) == (course_id, 1, 2)
    assert item["last_lesson_id"] == first
    assert learning["bookmarks"] == [
        {"course_id": course_id, "course_title": "Learn it", "lesson_id": first, "lesson_title": "One", "note": "n"}
    ]
    assert client.get("/api/me/learning/").status_code == 401


def test_quiz_results_are_kept_and_feed_the_authors_stats(client, auth):
    course_id = two_lesson_course(client, auth(sub="ada"))["id"]
    first, second = lesson_ids(client, course_id, auth(sub="bob"))
    url = f"/api/courses/{course_id}/lessons/{second}/quizzes/q1/check/"
    client.post(url, json={"selected": ["b"]}, headers=auth(sub="bob"))  # wrong first
    client.post(url, json={"selected": ["a"]}, headers=auth(sub="bob"))  # then right
    client.post(url, json={"selected": ["a"]}, headers=auth(sub="cat"))
    progress(client, course_id, first, auth(sub="bob"), completed=True)

    detail = client.get(f"/api/courses/{course_id}/", headers=auth(sub="bob")).json()
    assert detail["enrollment"]["quiz_results"] == {"q1": True}

    stats = client.get(f"/api/courses/{course_id}/stats/", headers=auth(sub="ada")).json()
    assert stats["learners"] == 1  # cat answered as a guest-like visitor without enrolling
    assert stats["lessons"][0]["completed"] == 1
    assert stats["quizzes"][0]["learners"] == 2 and stats["quizzes"][0]["first_try_correct"] == 1
    assert stats["average_progress"] == 0.5
    assert client.get(f"/api/courses/{course_id}/stats/", headers=auth(sub="bob")).status_code == 404


def test_my_teaching_lists_every_own_course(client, auth):
    two_lesson_course(client, auth(sub="ada"))
    two_lesson_course(client, auth(sub="ada"), status="draft")
    two_lesson_course(client, auth(sub="bob"))
    teaching = client.get("/api/me/teaching/", headers=auth(sub="ada")).json()
    assert sorted(item["course"]["status"] for item in teaching) == ["draft", "published"]
