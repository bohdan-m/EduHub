import test from "node:test";
import assert from "node:assert/strict";
import { gradeLocally, isAnswered, isFullQuiz, isMultipleChoice, quizChoices, toggleAnswer } from "../src/utils/quiz.js";
import type { PublicQuizBlock, QuizAnswer, QuizBlock } from "../src/utils/types/courses.js";

const base = { type: "quiz" as const, id: "q", question: "?", explanation: "Because.", options: [], answers: [], pairs: [] };
const quiz = (...correct: boolean[]): QuizBlock => ({
    ...base, kind: "choice",
    options: correct.map((isCorrect, i) => ({ id: `o${i}`, text: `Answer ${i}`, correct: isCorrect })),
});
const picked = (...selected: string[]): QuizAnswer => ({ selected, text: "", matches: {} });

test("one correct answer behaves like radio buttons", () => {
    const single = quiz(false, true, false);
    assert.equal(isMultipleChoice(single), false);
    assert.deepEqual(toggleAnswer(false, ["o0"], "o1"), ["o1"]);
    const result = gradeLocally(single, picked("o1"));
    assert.equal(result.correct, true);
    assert.deepEqual(result.correct_option_ids, ["o1"]);
    assert.equal(result.explanation, "Because.");
    assert.equal(gradeLocally(single, picked("o0")).correct, false);
});

test("several correct answers need all of them and nothing else", () => {
    const multi = quiz(true, false, true);
    assert.equal(isMultipleChoice(multi), true);
    assert.deepEqual(toggleAnswer(true, ["o0"], "o2"), ["o0", "o2"]);
    assert.deepEqual(toggleAnswer(true, ["o0", "o2"], "o0"), ["o2"]);
    assert.equal(gradeLocally(multi, picked("o2", "o0")).correct, true);
    assert.equal(gradeLocally(multi, picked("o0")).correct, false, "a missing answer is wrong");
    assert.equal(gradeLocally(multi, picked("o0", "o1", "o2")).correct, false, "an extra answer is wrong");
    assert.equal(isAnswered(multi, picked()), false);
});

test("short answers ignore case and spacing", () => {
    const short: QuizBlock = { ...base, kind: "short", answers: ["New York", "NYC"] };
    assert.equal(gradeLocally(short, { selected: [], text: "  new   york ", matches: {} }).correct, true);
    assert.equal(gradeLocally(short, { selected: [], text: "nyc", matches: {} }).correct, true);
    const wrong = gradeLocally(short, { selected: [], text: "Boston", matches: {} });
    assert.equal(wrong.correct, false);
    assert.deepEqual(wrong.accepted_answers, ["New York", "NYC"]);
    assert.equal(isAnswered(short, { selected: [], text: " ", matches: {} }), false);
});

test("matching needs every pair right, and offers the right sides in alphabetical order", () => {
    const match: QuizBlock = {
        ...base, kind: "match",
        pairs: [{ id: "p1", left: "SELECT", right: "reads rows" }, { id: "p2", left: "DELETE", right: "Removes rows" }],
    };
    assert.deepEqual(quizChoices(match).rights, ["reads rows", "Removes rows"]);
    const all = { p1: "reads rows", p2: "removes rows" };
    assert.equal(gradeLocally(match, { selected: [], text: "", matches: all }).correct, true);
    assert.equal(gradeLocally(match, { selected: [], text: "", matches: { p1: "reads rows" } }).correct, false);
    assert.equal(isAnswered(match, { selected: [], text: "", matches: { p1: "reads rows" } }), false);
    assert.equal(isAnswered(match, { selected: [], text: "", matches: all }), true);
});

test("a learner's quiz has no answers, only what to choose from", () => {
    const publicQuiz: PublicQuizBlock = { type: "quiz", id: "q", kind: "choice", question: "?", multiple: true, options: [{ id: "a", text: "A" }] };
    assert.equal(isFullQuiz(publicQuiz), false);
    assert.equal(isMultipleChoice(publicQuiz), true);
    assert.equal(isFullQuiz(quiz(true, false)), true);
    const publicMatch: PublicQuizBlock = { type: "quiz", id: "m", kind: "match", question: "?", lefts: [{ id: "p1", text: "A" }], rights: ["x"] };
    assert.deepEqual(quizChoices(publicMatch).rights, ["x"]);
});
