import type { PublicQuizBlock, QuizAnswer, QuizBlock, QuizResult } from "./types/courses.js";

/** True for the author's own copy of a quiz, which carries the answers. */
export const isFullQuiz = (quiz: QuizBlock | PublicQuizBlock): quiz is QuizBlock =>
    "answers" in quiz && "pairs" in quiz;

/** More than one correct option makes a choice quiz "select all that apply". */
export const isMultipleChoice = (quiz: QuizBlock | PublicQuizBlock) =>
    isFullQuiz(quiz) ? quiz.options.filter((o) => o.correct).length > 1 : Boolean(quiz.multiple);

/** What the learner sees to choose from, the same for both shapes. */
export function quizChoices(quiz: QuizBlock | PublicQuizBlock) {
    if (isFullQuiz(quiz)) {
        return {
            options: quiz.options.map(({ id, text }) => ({ id, text })),
            lefts: quiz.pairs.map((p) => ({ id: p.id, text: p.left })),
            // alphabetical, like the API, so the order gives nothing away
            rights: quiz.pairs.map((p) => p.right).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
        };
    }
    return { options: quiz.options ?? [], lefts: quiz.lefts ?? [], rights: quiz.rights ?? [] };
}

/** Picking an answer: radio behaviour for one correct answer, checkbox behaviour for several. */
export function toggleAnswer(multiple: boolean, selectedIds: string[], id: string): string[] {
    if (!multiple) return [id];
    return selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

/** Grading when the answers are already here (the author's preview of an unsaved lesson). Learners are graded by
 *  the API instead (Backend/app/content.py); both give the same result. */
export function gradeLocally(quiz: QuizBlock, answer: QuizAnswer): QuizResult {
    const base = { correct_option_ids: [], accepted_answers: [], correct_matches: {}, explanation: quiz.explanation };
    if (quiz.kind === "short") {
        const correct = quiz.answers.some((a) => normalize(a) === normalize(answer.text));
        return { ...base, correct, accepted_answers: quiz.answers };
    }
    if (quiz.kind === "match") {
        const expected = Object.fromEntries(quiz.pairs.map((p) => [p.id, p.right]));
        const ids = Object.keys(expected);
        const correct = ids.length === Object.keys(answer.matches).length
            && ids.every((id) => normalize(answer.matches[id] ?? "") === normalize(expected[id]));
        return { ...base, correct, correct_matches: expected };
    }
    const correctIds = quiz.options.filter((o) => o.correct).map((o) => o.id);
    const correct = correctIds.length === answer.selected.length && correctIds.every((id) => answer.selected.includes(id));
    return { ...base, correct, correct_option_ids: correctIds };
}

/** Whether the learner has given a full answer that can be checked. */
export function isAnswered(quiz: QuizBlock | PublicQuizBlock, answer: QuizAnswer): boolean {
    if (quiz.kind === "short") return answer.text.trim().length > 0;
    if (quiz.kind === "match") return quizChoices(quiz).lefts.every((left) => answer.matches[left.id]);
    return answer.selected.length > 0;
}
