import type { PublicQuizBlock, QuizBlock, QuizResult } from "./types/courses.js";

export const isFullQuiz = (quiz: QuizBlock | PublicQuizBlock): quiz is QuizBlock => quiz.options.every((o) => "correct" in o);

/** More than one correct answer makes it "select all that apply". */
export const isMultipleChoice = (quiz: QuizBlock | PublicQuizBlock) =>
    isFullQuiz(quiz) ? quiz.options.filter((o) => o.correct).length > 1 : quiz.multiple;

/** Picking an answer: radio behaviour for one correct answer, checkbox behaviour for several. */
export function toggleAnswer(multiple: boolean, selectedIds: string[], id: string): string[] {
    if (!multiple) return [id];
    return selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
}

/** Grading when the answers are already here (the author's preview of an unsaved lesson). Learners are graded by
 *  the API instead; both give the same result shape. Right only when exactly the correct answers are picked. */
export function gradeLocally(quiz: QuizBlock, selectedIds: string[]): QuizResult {
    const correctIds = quiz.options.filter((o) => o.correct).map((o) => o.id);
    const correct = correctIds.length === selectedIds.length && correctIds.every((id) => selectedIds.includes(id));
    return { correct, correct_option_ids: correctIds, explanation: quiz.explanation };
}
