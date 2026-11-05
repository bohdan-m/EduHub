"use client";

import { useId, useState } from "react";
import { Button } from "@heroui/react";
import { IconCheck, IconCircleCheckFilled, IconCircleXFilled, IconX } from "@tabler/icons-react";
import Markdown from "@/components/Lesson/Markdown";
import { getApiErrorMessage } from "@/utils/apiError";
import { isAnswered, isMultipleChoice, quizChoices, toggleAnswer } from "@/utils/quiz";
import type { PublicQuizBlock, QuizAnswer, QuizBlock, QuizResult } from "@/utils/types/courses";

export type GradeQuiz = (quiz: QuizBlock | PublicQuizBlock, answer: QuizAnswer) => Promise<QuizResult>;

const emptyAnswer = (): QuizAnswer => ({ selected: [], text: "", matches: {} });
const INSTRUCTIONS = { choice: "", short: "Type your answer.", match: "Match each item on the left with one on the right." };

// Learners' quizzes come without answers; `grade` asks the API (or, in the author's preview, checks locally).
// `answered`: whether this learner got it right last time (from their saved progress), shown until they try again.
function QuizView({ quiz, grade, answered }: { quiz: QuizBlock | PublicQuizBlock; grade: GradeQuiz; answered?: boolean }) {
  const kind = quiz.kind ?? "choice";
  const isMultiple = isMultipleChoice(quiz);
  const { options, lefts, rights } = quizChoices(quiz);
  const [answer, setAnswer] = useState<QuizAnswer>(emptyAnswer);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const locked = Boolean(result) || isChecking;

  const check = async () => {
    setIsChecking(true);
    setError(null);
    try {
      setResult(await grade(quiz, answer));
    } catch (gradeError) {
      setError(getApiErrorMessage(gradeError, "Couldn't check the answer. Try again."));
    }
    setIsChecking(false);
  };

  const reset = () => {
    setResult(null);
    setAnswer(emptyAnswer());
  };

  const instruction = kind === "choice" ? (isMultiple ? "Select all that apply." : "Choose one answer.") : INSTRUCTIONS[kind];

  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-label="Quiz">
      <p className="m-0 flex items-center gap-2 text-xs font-medium tracking-wide text-accent">
        QUIZ
        {answered !== undefined && !result && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium tracking-normal ${answered ? "bg-success/15 text-success" : "bg-default text-muted"}`}>
            {answered ? "You got this right" : "Answered before"}
          </span>
        )}
      </p>
      <h3 className="m-0 mt-1 text-base font-semibold [overflow-wrap:anywhere]">{quiz.question}</h3>
      <p className="m-0 mt-1 text-sm text-muted">{instruction}</p>

      {kind === "choice" && (
        <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0" role={isMultiple ? "group" : "radiogroup"} aria-label={quiz.question}>
          {options.map((option) => {
            const isSelected = answer.selected.includes(option.id);
            const isCorrect = result?.correct_option_ids.includes(option.id);
            let state = isSelected ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-secondary";
            let mark = null;
            if (result && isCorrect) {
              state = "border-success/60 bg-success/10";
              mark = <IconCircleCheckFilled size={18} className="shrink-0 text-success" aria-label="Correct answer" />;
            } else if (result && isSelected) {
              state = "border-danger/60 bg-danger/10";
              mark = <IconCircleXFilled size={18} className="shrink-0 text-danger" aria-label="Wrong answer" />;
            }
            return (
              <li key={option.id}>
                <button
                  type="button"
                  role={isMultiple ? "checkbox" : "radio"}
                  aria-checked={isSelected}
                  aria-label={option.text}
                  disabled={locked}
                  onClick={() => setAnswer((a) => ({ ...a, selected: toggleAnswer(isMultiple, a.selected, option.id) }))}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default ${state}`}
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center border ${isMultiple ? "rounded" : "rounded-full"} ${isSelected ? "border-accent bg-accent text-accent-foreground" : "border-border-tertiary bg-surface"}`}
                    aria-hidden
                  >
                    {isSelected && (isMultiple ? <IconCheck size={12} /> : <span className="size-1.5 rounded-full bg-current" />)}
                  </span>
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{option.text}</span>
                  {mark}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {kind === "short" && (
        <div className="mt-4">
          <label htmlFor={inputId} className="sr-only">Your answer</label>
          <input
            id={inputId}
            className="w-full rounded-lg border border-border bg-field px-3 py-2 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-80"
            value={answer.text}
            maxLength={200}
            disabled={locked}
            onChange={(event) => setAnswer((a) => ({ ...a, text: event.target.value }))}
            onKeyDown={(event) => { if (event.key === "Enter" && isAnswered(quiz, answer) && !locked) void check(); }}
          />
          {result && !result.correct && result.accepted_answers.length > 0 && (
            <p className="m-0 mt-2 text-sm">Accepted answer: <strong>{result.accepted_answers[0]}</strong></p>
          )}
        </div>
      )}

      {kind === "match" && (
        <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
          {lefts.map((left) => {
            const picked = answer.matches[left.id] ?? "";
            const expected = result?.correct_matches[left.id];
            const isRight = result && expected?.toLowerCase() === picked.toLowerCase();
            return (
              <li key={left.id} className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr] sm:items-center ${result ? (isRight ? "border-success/60 bg-success/10" : "border-danger/60 bg-danger/10") : "border-border"}`}>
                <label htmlFor={`${inputId}-${left.id}`} className="text-sm font-medium [overflow-wrap:anywhere]">{left.text}</label>
                <div>
                  <select
                    id={`${inputId}-${left.id}`}
                    className="w-full rounded-lg border border-border bg-field px-2 py-1.5 text-sm disabled:opacity-80"
                    value={picked}
                    disabled={locked}
                    onChange={(event) => setAnswer((a) => ({ ...a, matches: { ...a.matches, [left.id]: event.target.value } }))}
                  >
                    <option value="">Choose…</option>
                    {rights.map((right) => <option key={right} value={right}>{right}</option>)}
                  </select>
                  {result && !isRight && expected && <p className="m-0 mt-1 text-xs">Correct: <strong>{expected}</strong></p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {result && (
        <div className={`mt-4 rounded-lg p-3 text-sm ${result.correct ? "bg-success/10" : "bg-danger/10"}`} role="status">
          <p className="m-0 flex items-center gap-1.5 font-semibold">
            {result.correct ? <IconCheck size={16} aria-hidden /> : <IconX size={16} aria-hidden />}
            {result.correct ? "Correct!" : "Not quite."}
          </p>
          {result.explanation && <div className="mt-1"><Markdown text={result.explanation} /></div>}
        </div>
      )}
      {error && <p className="m-0 mt-3 text-sm text-danger" role="alert">{error}</p>}

      <div className="mt-4 flex gap-2">
        {result ? (
          <Button size="sm" variant="outline" onPress={reset}>Try again</Button>
        ) : (
          <Button size="sm" isDisabled={!isAnswered(quiz, answer)} isPending={isChecking} onPress={check}>Check answer</Button>
        )}
      </div>
    </section>
  );
}

export default QuizView;
