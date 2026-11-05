"""Lesson blocks: how long they take, how learners see them, and how quizzes are graded."""
import math
import re

from fastapi import Request

from app.media import media_url
from app.schemas import QuizAnswerIn, QuizResultOut

# rough reading and watching times; good enough for "about 40 min" on a course card
WORDS_PER_MINUTE = 200
BLOCK_MINUTES = {"video": 6, "quiz": 1, "link": 2, "file": 2}


def lesson_minutes(blocks: list[dict]) -> float:
    words = sum(len(str(b.get("text", "")).split()) for b in blocks if b.get("type") in ("text", "callout"))
    return max(1.0, words / WORDS_PER_MINUTE + sum(BLOCK_MINUTES.get(b.get("type"), 0) for b in blocks))


def course_totals(lessons_blocks: list[list[dict]]) -> tuple[int, int]:
    """(lesson count, estimated minutes) for a course's lessons."""
    return len(lessons_blocks), math.ceil(sum(lesson_minutes(blocks) for blocks in lessons_blocks))


def upload_paths(blocks: list[dict]) -> set[str]:
    return {b["path"] for b in blocks if b.get("type") in ("image", "file")}


def present_block(block: dict, request: Request, full: bool) -> dict:
    """A stored block as the API sends it. Uploads get their URL; for anyone but the author (`full`), quizzes lose
    their answers and explanation, which only POST .../check/ reveals."""
    if block.get("type") in ("image", "file"):
        return {**block, "url": media_url(request, block["path"])}
    if block.get("type") != "quiz" or full:
        return block

    kind = block.get("kind", "choice")
    public = {"type": "quiz", "id": block["id"], "kind": kind, "question": block["question"]}
    if kind == "choice":
        options = block.get("options", [])
        public["options"] = [{"id": option["id"], "text": option["text"]} for option in options]
        public["multiple"] = sum(1 for option in options if option.get("correct")) > 1
    elif kind == "match":
        pairs = block.get("pairs", [])
        public["lefts"] = [{"id": pair["id"], "text": pair["left"]} for pair in pairs]
        # sorted, not in authored order, so the position gives nothing away
        public["rights"] = sorted((pair["right"] for pair in pairs), key=str.casefold)
    return public


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().casefold()


def grade(quiz: dict, answer: QuizAnswerIn) -> QuizResultOut:
    kind = quiz.get("kind", "choice")
    explanation = quiz.get("explanation", "")
    if kind == "short":
        accepted = quiz.get("answers", [])
        correct = _normalize(answer.text) in {_normalize(a) for a in accepted}
        return QuizResultOut(correct=correct, accepted_answers=accepted, explanation=explanation)
    if kind == "match":
        expected = {pair["id"]: pair["right"] for pair in quiz.get("pairs", [])}
        given = {left: _normalize(right) for left, right in answer.matches.items()}
        correct = set(given) == set(expected) and all(given[k] == _normalize(v) for k, v in expected.items())
        return QuizResultOut(correct=correct, correct_matches=expected, explanation=explanation)
    correct_ids = [option["id"] for option in quiz.get("options", []) if option.get("correct")]
    return QuizResultOut(
        correct=set(answer.selected) == set(correct_ids), correct_option_ids=correct_ids, explanation=explanation
    )
