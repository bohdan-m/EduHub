"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Spinner, buttonVariants } from "@heroui/react";
import { IconAlertCircle, IconBookmarkFilled, IconCertificate } from "@tabler/icons-react";
import { learningApi, type Bookmark, type LearningItem } from "@/api/learning.api";
import CourseCard from "@/components/Courses/CourseCard";

function Progress({ item }: { item: LearningItem }) {
  const percent = item.total_lessons ? Math.round((item.completed_lessons / item.total_lessons) * 100) : 0;
  const resume = item.last_lesson_id ? `/courses/${item.course.id}?lesson=${item.last_lesson_id}` : `/courses/${item.course.id}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs text-muted tabular-nums">
        <span>{item.completed_lessons}/{item.total_lessons} lessons</span>
        <span>{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-default" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}
        aria-label={`${item.course.title}: progress`}>
        <div className="h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
      </div>
      {item.certificate_code ? (
        <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={`/certificates/${item.certificate_code}`}>
          <IconCertificate size={16} aria-hidden /> Certificate
        </Link>
      ) : (
        <Link className={buttonVariants({ size: "sm" })} href={resume}>{item.completed_lessons ? "Continue" : "Start"}</Link>
      )}
    </div>
  );
}

/** Courses the user is taking (most recent first), finished ones with their certificates, and bookmarked lessons. */
function MyLearning() {
  const [data, setData] = useState<{ courses: LearningItem[]; bookmarks: Bookmark[] } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    learningApi.myLearning().then(setData).catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <Alert status="danger" className="mt-8">
        <Alert.Indicator><IconAlertCircle size={20} /></Alert.Indicator>
        <Alert.Content><Alert.Description>Couldn&rsquo;t load your courses. Reload the page to try again.</Alert.Description></Alert.Content>
      </Alert>
    );
  }
  if (!data) {
    return <div className="mt-10 flex items-center justify-center gap-3 py-12 text-muted" role="status"><Spinner size="sm" /> Loading…</div>;
  }

  const inProgress = data.courses.filter((item) => !item.completed_at);
  const finished = data.courses.filter((item) => item.completed_at);
  const grid = (items: LearningItem[]) => (
    <ul className="m-0 mt-5 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => <li key={item.course.id}><CourseCard course={item.course} footer={<Progress item={item} />} /></li>)}
    </ul>
  );

  return (
    <div className="mt-4 flex flex-col gap-12 pb-6">
      <section className="flex flex-col gap-2 border-b border-separator pb-8">
        <h1 className="m-0 text-[clamp(28px,4vw,40px)] font-semibold tracking-tight">My learning</h1>
        <p className="m-0 text-muted">Pick up where you left off.</p>
      </section>

      {data.courses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-tertiary px-6 py-12 text-center">
          <p className="m-0 text-lg font-semibold">You haven&rsquo;t started a course yet</p>
          <p className="m-0 text-muted">Find one you like and press Start; your progress is saved as you go.</p>
          <Link className={buttonVariants()} href="/home">Browse courses</Link>
        </div>
      ) : (
        <>
          {inProgress.length > 0 && <section aria-labelledby="progress-heading"><h2 id="progress-heading" className="m-0 text-xl font-semibold">In progress</h2>{grid(inProgress)}</section>}
          {finished.length > 0 && <section aria-labelledby="finished-heading"><h2 id="finished-heading" className="m-0 text-xl font-semibold">Finished</h2>{grid(finished)}</section>}
        </>
      )}

      {data.bookmarks.length > 0 && (
        <section aria-labelledby="bookmarks-heading">
          <h2 id="bookmarks-heading" className="m-0 text-xl font-semibold">Bookmarked lessons</h2>
          <ul className="m-0 mt-4 flex list-none flex-col divide-y divide-separator rounded-2xl border border-border bg-surface p-0">
            {data.bookmarks.map((bookmark) => (
              <li key={bookmark.lesson_id} className="flex items-start gap-3 px-5 py-3">
                <IconBookmarkFilled size={16} className="mt-1 shrink-0 text-accent" aria-hidden />
                <div className="min-w-0">
                  <Link href={`/courses/${bookmark.course_id}?lesson=${bookmark.lesson_id}`} className="font-medium">{bookmark.lesson_title}</Link>
                  <p className="m-0 text-sm text-muted">{bookmark.course_title}</p>
                  {bookmark.note && <p className="m-0 mt-1 line-clamp-2 text-sm whitespace-pre-line">{bookmark.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default MyLearning;
