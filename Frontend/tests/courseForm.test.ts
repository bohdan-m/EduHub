import test from "node:test";
import assert from "node:assert/strict";
import {
    buildCoursePayload, createBlock, createQuiz, draftFromCourse, duplicateLesson, emptyDetails, findProblems, validateBlock, type CourseDraft,
} from "../src/utils/courseForm.js";
import { parseDraftData } from "../src/utils/draftData.js";
import type { CourseDetail, QuizBlock } from "../src/utils/types/courses.js";

const draft = (): CourseDraft => ({
    title: "  UX Research  ",
    description: "  Learn the process  ",
    stages: [
        {
            key: "s1",
            id: 7,
            title: "  Discover  ",
            lessons: [
                { key: "l1", id: 11, title: "  Interviews  ", blocks: [{ type: "text", id: "t", text: "  Hello  " }] },
                { key: "l2", title: " Surveys ", blocks: [] },
            ],
        },
        { key: "s2", title: " Define ", lessons: [{ key: "l3", title: "Synthesis", blocks: [] }] },
    ],
    details: { ...emptyDetails(), category: "design", outcomes: ["  Run interviews ", "", " "] },
});

test("buildCoursePayload trims text, numbers positions from 1 and keeps only server ids", () => {
    const payload = buildCoursePayload(draft());

    assert.equal(payload.title, "UX Research");
    assert.equal(payload.category, "design");
    assert.equal(payload.status, "draft");
    assert.deepEqual(payload.outcomes, ["Run interviews"]);
    assert.deepEqual(payload.stages, [
        {
            id: 7,
            title: "Discover",
            order: 1,
            lessons: [
                { id: 11, title: "Interviews", order: 1, blocks: [{ type: "text", id: "t", text: "Hello" }] },
                { title: "Surveys", order: 2, blocks: [] },
            ],
        },
        { title: "Define", order: 2, lessons: [{ title: "Synthesis", order: 1, blocks: [] }] },
    ]);
});

test("draftFromCourse keeps server ids and blocks", () => {
    const course: CourseDetail = {
        id: 1, title: "T", description: "D", created_at: "", updated_at: "", published_at: null, status: "published",
        category: "data", level: "beginner", language: "en", lesson_count: 1, estimated_minutes: 1, author: null, images: [],
        rating: { average: null, count: 0 }, learner_count: 0, outcomes: ["One"], requirements: [], intro_video_url: "",
        is_owner: true, is_hidden: false, enrollment: null, my_review_id: null,
        stages: [{ id: 3, title: "S", order: 1, lessons: [{ id: 4, title: "L", order: 1, blocks: [{ type: "callout", id: "c", tone: "tip", text: "x" }] }] }],
    };
    const result = draftFromCourse(course);
    assert.equal(result.stages[0].id, 3);
    assert.equal(result.stages[0].lessons[0].id, 4);
    assert.deepEqual(result.stages[0].lessons[0].blocks, course.stages[0].lessons[0].blocks);
    assert.notEqual(result.stages[0].key, result.stages[0].lessons[0].key);
    assert.equal(result.details.status, "published");
    assert.deepEqual(result.details.outcomes, ["One"]);
});

test("duplicating a lesson gives it and its quiz parts new ids", () => {
    const quiz = createQuiz("match");
    const copy = duplicateLesson({ key: "l1", id: 9, title: "Joins", blocks: [quiz] });
    assert.equal(copy.title, "Joins (copy)");
    assert.equal(copy.id, undefined);
    const copied = copy.blocks[0] as QuizBlock;
    assert.notEqual(copied.id, quiz.id);
    assert.notEqual(copied.pairs[0].id, quiz.pairs[0].id);
});

test("drafts saved before course details get the defaults", () => {
    const old = { title: "T", description: "D", stages: [{ key: "s", title: "S", lessons: [{ key: "l", title: "L", blocks: [
        { type: "quiz", id: "q", question: "?", explanation: "", options: [] },
    ] }] }] };
    const parsed = parseDraftData(old);
    assert.equal(parsed?.details.status, "draft");
    assert.equal((parsed?.stages[0].lessons[0].blocks[0] as QuizBlock).kind, "choice");
    assert.equal(parseDraftData({ title: 1 }), null);
});

test("new blocks start empty and invalid, with unique ids", () => {
    const quiz = createBlock("quiz") as QuizBlock;
    assert.equal(quiz.options.length, 2);
    assert.notEqual(quiz.options[0].id, quiz.options[1].id);
    assert.match(quiz.id, /^[A-Za-z0-9_-]{1,40}$/);
    for (const type of ["text", "video", "link", "callout", "image", "file", "quiz"] as const) {
        assert.ok(validateBlock(createBlock(type)), `${type} should need input`);
    }
});

test("validateBlock mirrors the API's rules", () => {
    const quiz: QuizBlock = {
        type: "quiz", id: "q", kind: "choice", question: "Pick", explanation: "", answers: [], pairs: [],
        options: [{ id: "a", text: "A", correct: false }, { id: "b", text: "B", correct: false }],
    };
    assert.equal(validateBlock(quiz), "Mark at least one answer as correct.");
    assert.equal(validateBlock({ ...quiz, options: [{ ...quiz.options[0], correct: true }, { ...quiz.options[1], text: " " }] }), "Answer 2 is empty.");
    assert.equal(validateBlock({ ...quiz, options: [{ ...quiz.options[0], correct: true }, quiz.options[1]] }), null);

    assert.equal(validateBlock({ type: "link", id: "l", url: "javascript:alert(1)", title: "x", description: "" }),
        "Use a full web address starting with https://.");
    assert.equal(validateBlock({ type: "link", id: "l", url: "https://example.com", title: "Docs", description: "" }), null);
    assert.equal(validateBlock({ type: "video", id: "v", url: "https://example.com/v.mp4", caption: "" }),
        "Use a YouTube or Vimeo video link, like https://www.youtube.com/watch?v=…");
    assert.equal(validateBlock({ type: "video", id: "v", url: "https://vimeo.com/76979871", caption: "" }), null);
    assert.equal(validateBlock({ ...createQuiz("short"), question: "Capital?" }), "Add at least one accepted answer.");
    const match = { ...createQuiz("match"), question: "Match" };
    assert.equal(validateBlock(match), "Pair 1 needs both sides.");
    match.pairs = match.pairs.map((p, i) => ({ ...p, left: `L${i}`, right: "same" }));
    assert.equal(validateBlock(match), "Each pair needs a different right-hand side.");
    assert.equal(validateBlock({ type: "image", id: "i", path: "", alt: "x", caption: "" }), "Upload an image.");
    assert.equal(validateBlock({ type: "video", id: "v", url: "https://youtu.be/aqz-KE-bpKQ", caption: "" }), null);
});

test("findProblems points at the part of the course to open", () => {
    const value = draft();
    value.title = "";
    value.stages[1].lessons[0].title = " ";
    value.stages[0].lessons[1].blocks = [createBlock("video")];

    assert.deepEqual(findProblems(value), [
        { target: "details", message: "Enter a course title." },
        { target: "l2", message: "Lesson 1.2, block 1: Add a YouTube or Vimeo link." },
        { target: "l3", message: "Lesson 2.1: Enter a lesson title." },
    ]);
    assert.deepEqual(findProblems(draft()), []);
    // publishing also needs content in every lesson
    assert.deepEqual(findProblems(draft(), { publishing: true }).map((p) => p.target), ["l2", "l3"]);
});
