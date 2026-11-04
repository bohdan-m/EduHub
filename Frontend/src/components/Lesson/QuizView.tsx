"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { IconCheck, IconCircleCheckFilled, IconCircleXFilled, IconX } from "@tabler/icons-react";
import Markdown from "@/components/Lesson/Markdown";
import { getApiErrorMessage } from "@/utils/apiError";
import { isMultipleChoice, toggleAnswer } from "@/utils/quiz";
import type { PublicQuizBlock, QuizBlock, QuizResult } from "@/utils/types/courses";

export type GradeQuiz = (quiz: QuizBlock | PublicQuizBlock, selectedIds: string[]) => Promise<QuizResult>;

// Learners' quizzes come without answers; `grade` asks the API (or, in the author's preview, checks locally)
function QuizView({ quiz, grade }: { quiz: QuizBlock | PublicQuizBlock; grade: GradeQuiz }) {
  const isMultiple = isMultipleChoice(quiz);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    if (!result) setSelected((current) => toggleAnswer(isMultiple, current, id));
  };

  const check = async () => {
    setIsChecking(true);
    setError(null);
    try {
      setResult(await grade(quiz, selected));
    } catch (gradeError) {
      setError(getApiErrorMessage(gradeError, "Couldn't check the answer. Try again."));
    }
    setIsChecking(false);
  };

  const reset = () => {
    setResult(null);
    setSelected([]);
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-label="Quiz">
      <p className="m-0 text-xs font-medium tracking-wide text-accent">QUIZ</p>
      <h3 className="m-0 mt-1 text-base font-semibold [overflow-wrap:anywhere]">{quiz.question}</h3>
      <p className="m-0 mt-1 text-sm text-muted">{isMultiple ? "Select all that apply." : "Choose one answer."}</p>

      <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0" role={isMultiple ? "group" : "radiogroup"} aria-label={quiz.question}>
        {quiz.options.map((option) => {
          const isSelected = selected.includes(option.id);
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
                disabled={Boolean(result) || isChecking}
                onClick={() => toggle(option.id)}
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
          <Button size="sm" isDisabled={selected.length === 0} isPending={isChecking} onPress={check}>Check answer</Button>
        )}
      </div>
    </section>
  );
}

export default QuizView;
