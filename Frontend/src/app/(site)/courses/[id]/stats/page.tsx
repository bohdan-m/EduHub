"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Card, Spinner, buttonVariants } from "@heroui/react";
import { IconAlertCircle, IconArrowLeft } from "@tabler/icons-react";
import { coursesApi, type CourseStats } from "@/api/courses.api";
import { RatingSummary } from "@/components/Stars";

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-default" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
    </div>
  );
}

/** How learners are doing in one of the author's courses: completion per lesson and the quizzes they miss most. */
export default function CourseStatsPage() {
  const { id } = useParams<{ id: string }>();
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Course stats · EduHub";
    coursesApi.courseDetail(id).then((course) => setTitle(course.title)).catch(() => undefined);
    coursesApi.stats(id).then(setStats)
      .catch((failure) => setError(failure?.response?.status === 404 ? "Only the course's author can see its stats." : "Couldn't load the stats."));
  }, [id]);

  const back = (
    <Link className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2 self-start text-muted" })} href={`/courses/${id}`}>
      <IconArrowLeft size={16} aria-hidden /> Back to the course
    </Link>
  );

  if (error) {
    return (
      <div className="mt-4 flex flex-col gap-6">{back}
        <Alert status="danger"><Alert.Indicator><IconAlertCircle size={20} /></Alert.Indicator><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>
      </div>
    );
  }
  if (!stats) return <div className="mt-10 flex items-center justify-center gap-3 py-12 text-muted" role="status"><Spinner size="sm" /> Loading stats…</div>;

  return (
    <div className="mt-4 flex flex-col gap-8 pb-6">
      <div className="flex flex-col gap-2">
        {back}
        <h1 className="m-0 text-[clamp(26px,3.5vw,36px)] font-semibold tracking-tight">Stats{title && <span className="text-muted">: {title}</span>}</h1>
      </div>

      <dl className="m-0 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Learners", String(stats.learners)],
          ["Finished", `${stats.completed} (${percent(stats.completed, stats.learners)}%)`],
          ["Average progress", `${Math.round(stats.average_progress * 100)}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="m-0 mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="rounded-2xl border border-border bg-surface p-4">
          <dt className="text-sm text-muted">Rating</dt>
          <dd className="m-0 mt-2"><RatingSummary average={stats.rating.average} count={stats.rating.count} /></dd>
        </div>
      </dl>

      {stats.learners === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-border-tertiary px-6 py-10 text-center text-muted">
          No learners yet. Once people start the course, you&rsquo;ll see where they get stuck.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="gap-4 p-5 sm:p-6">
            <h2 className="m-0 text-lg font-semibold">Lessons finished</h2>
            <p className="m-0 text-sm text-muted">A sharp drop shows where learners give up.</p>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {stats.lessons.map((lesson, i) => {
                const value = percent(lesson.completed, stats.learners);
                return (
                  <li key={lesson.id} className="flex flex-col gap-1">
                    <div className="flex justify-between gap-3 text-sm"><span className="truncate">{i + 1}. {lesson.title}</span><span className="text-muted tabular-nums">{value}%</span></div>
                    <Bar value={value} label={`${lesson.title}: ${value}% of learners finished it`} />
                  </li>
                );
              })}
            </ol>
          </Card>
          <Card className="gap-4 p-5 sm:p-6">
            <h2 className="m-0 text-lg font-semibold">Hardest quizzes</h2>
            <p className="m-0 text-sm text-muted">Right on the first try. A low score may mean the lesson needs a clearer explanation.</p>
            {stats.quizzes.length === 0 ? <p className="m-0 text-sm text-muted">No quiz answers yet.</p> : (
              <ol className="m-0 flex list-none flex-col gap-3 p-0">
                {stats.quizzes.map((quiz) => {
                  const value = percent(quiz.first_try_correct, quiz.learners);
                  return (
                    <li key={`${quiz.lesson_id}-${quiz.block_id}`} className="flex flex-col gap-1">
                      <p className="m-0 text-sm [overflow-wrap:anywhere]">{quiz.question}</p>
                      <div className="flex items-center gap-3">
                        <Bar value={value} label={`${value}% right on the first try`} />
                        <span className="w-24 text-right text-xs text-muted tabular-nums">{value}% of {quiz.learners}</span>
                      </div>
                      <Link className="text-xs text-muted" href={`/courses/${id}?lesson=${quiz.lesson_id}`}>{quiz.lesson_title}</Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
