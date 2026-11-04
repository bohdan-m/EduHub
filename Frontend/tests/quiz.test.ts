import test from "node:test";
import assert from "node:assert/strict";
import { gradeLocally, isFullQuiz, isMultipleChoice, toggleAnswer } from "../src/utils/quiz.js";
import type { PublicQuizBlock, QuizBlock } from "../src/utils/types/courses.js";

const quiz = (...correct: boolean[]): QuizBlock => ({
    type: "quiz", id: "q", question: "?", explanation: "Because.",
    options: correct.map((isCorrect, i) => ({ id: `o${i}`, text: `Answer ${i}`, correct: isCorrect })),
});

test("one correct answer behaves like radio buttons", () => {
    const single = quiz(false, true, false);
    assert.equal(isMultipleChoice(single), false);
    assert.deepEqual(toggleAnswer(false, ["o0"], "o1"), ["o1"]);
    assert.deepEqual(gradeLocally(single, ["o1"]), { correct: true, correct_option_ids: ["o1"], explanation: "Because." });
    assert.equal(gradeLocally(single, ["o0"]).correct, false);
});

test("several correct answers need all of them and nothing else", () => {
    const multi = quiz(true, false, true);
    assert.equal(isMultipleChoice(multi), true);
    assert.deepEqual(toggleAnswer(true, ["o0"], "o2"), ["o0", "o2"]);
    assert.deepEqual(toggleAnswer(true, ["o0", "o2"], "o0"), ["o2"]);
    assert.equal(gradeLocally(multi, ["o2", "o0"]).correct, true);
    assert.equal(gradeLocally(multi, ["o0"]).correct, false, "a missing answer is wrong");
    assert.equal(gradeLocally(multi, ["o0", "o1", "o2"]).correct, false, "an extra answer is wrong");
    assert.equal(gradeLocally(multi, []).correct, false);
});

test("a learner's quiz has no answers, only whether it is multiple choice", () => {
    const publicQuiz: PublicQuizBlock = { type: "quiz", id: "q", question: "?", multiple: true, options: [{ id: "a", text: "A" }] };
    assert.equal(isFullQuiz(publicQuiz), false);
    assert.equal(isMultipleChoice(publicQuiz), true);
    assert.equal(isFullQuiz(quiz(true, false)), true);
});
