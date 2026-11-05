"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Spinner, buttonVariants } from "@heroui/react";
import { IconAlertCircle, IconChartBar, IconPencil, IconPlus } from "@tabler/icons-react";
import { learningApi, type TeachingItem } from "@/api/learning.api";
import CourseCard from "@/components/Courses/CourseCard";
import { plural } from "@/utils/courseMeta";

/** The author's dashboard: every course they wrote, in any state, with how it is doing. */
function Teaching() {
  const [items, setItems] = useState<TeachingItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    learningApi.myTeaching().then(setItems).catch(() => setError(true));
  }, []);

  const totals = items?.reduce((sum, item) => ({
    learners: sum.learners + item.course.learner_count,
    completed: sum.completed + item.completed,
    unanswered: sum.unanswered + item.unanswered_reviews,
  }), { learners: 0, completed: 0, unanswered: 0 });

  return (
    <div className="mt-4 flex flex-col gap-10 pb-6">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-separator pb-8">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[clamp(28px,4vw,40px)] font-semibold tracking-tight">Teach</h1>
          <p className="m-0 text-muted">Your courses, drafts included, and how learners are doing.</p>
        </div>
        <Link className={buttonVariants()} href="/courses/create"><IconPlus size={18} aria-hidden /> Create course</Link>
      </section>

      {error ? (
        <Alert status="danger">
          <Alert.Indicator><IconAlertCircle size={20} /></Alert.Indicator>
          <Alert.Content><Alert.Description>Couldn&rsquo;t load your courses. Reload the page to try again.</Alert.Description></Alert.Content>
        </Alert>
      ) : !items || !totals ? (
        <div className="flex items-center justify-center gap-3 py-12 text-muted" role="status"><Spinner size="sm" /> Loading…</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-tertiary px-6 py-12 text-center">
          <p className="m-0 text-lg font-semibold">Share what you know</p>
          <p className="m-0 max-w-[50ch] text-muted">Build a course from stages and lessons. It stays a private draft until you publish it.</p>
          <Link className={buttonVariants()} href="/courses/create">Create your first course</Link>
        </div>
      ) : (
        <>
          <dl className="m-0 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Courses", items.length],
              ["Learners", totals.learners],
              ["Finished a course", totals.completed],
              ["Reviews to answer", totals.unanswered],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border bg-surface p-4">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="m-0 mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.course.id}>
                <CourseCard course={item.course} showStatus footer={
                  <div className="flex flex-col gap-2">
                    <p className="m-0 text-xs text-muted">
                      {plural(item.completed, "learner")} finished
                      {item.unanswered_reviews > 0 && ` · ${plural(item.unanswered_reviews, "review")} to answer`}
                    </p>
                    <div className="flex gap-2">
                      <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={`/courses/${item.course.id}/edit`}><IconPencil size={16} aria-hidden /> Edit</Link>
                      <Link className={buttonVariants({ size: "sm", variant: "ghost" })} href={`/courses/${item.course.id}/stats`}><IconChartBar size={16} aria-hidden /> Stats</Link>
                    </div>
                  </div>
                } />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default Teaching;
