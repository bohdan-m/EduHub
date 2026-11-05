"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertDialog, Alert, Button, Card, Spinner, buttonVariants } from "@heroui/react";
import {
  IconAlertCircle, IconArrowLeft, IconCertificate, IconChartBar, IconCheck, IconCopy, IconEyeOff, IconPencil, IconTrash,
} from "@tabler/icons-react";
import { coursesApi } from "@/api/courses.api";
import { learningApi } from "@/api/learning.api";
import CourseCard from "@/components/Courses/CourseCard";
import LessonPlayer from "@/components/Course/LessonPlayer";
import Reviews from "@/components/Course/Reviews";
import ReportButton from "@/components/ReportButton";
import { RatingSummary } from "@/components/Stars";
import { authClient } from "@/lib/auth-client";
import { getApiErrorMessage } from "@/utils/apiError";
import { CATEGORIES, LANGUAGES, LEVELS, STATUSES, formatMinutes, plural } from "@/utils/courseMeta";
import type { CourseDetail, CourseListItem, CourseStatus, Enrollment } from "@/utils/types/courses";
import { getVideoEmbedUrl } from "@/utils/youtube";

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

const backLink = (
  <Link className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2 self-start text-muted" })} href="/home">
    <IconArrowLeft size={16} aria-hidden />
    All courses
  </Link>
);

/** The author's controls: visibility, edit, duplicate, stats and delete. */
function OwnerBar({ course, onChange }: { course: CourseDetail; onChange: (course: CourseDetail) => void }) {
  const router = useRouter();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(getApiErrorMessage(failure, "That didn't work. Try again."));
    }
    setBusy(null);
  };

  return (
    <Card className="gap-3 border border-accent/30 bg-accent-soft/50 p-4 shadow-none">
      <div className="flex flex-wrap items-center gap-3">
        <p className="m-0 flex-1 text-sm">
          <strong>{STATUSES[course.status].label}.</strong> {STATUSES[course.status].hint}
          {course.status === "draft" && " This page shows how learners will see it."}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Visibility</span>
          <select className="h-9 rounded-lg border border-border bg-field px-2 text-sm" value={course.status} disabled={busy !== null}
            onChange={(event) => run("status", async () => onChange(await coursesApi.setStatus(course.id, event.target.value as CourseStatus)))}>
            {(Object.keys(STATUSES) as CourseStatus[]).map((status) => <option key={status} value={status}>{STATUSES[status].label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/courses/${course.id}/edit`}>
          <IconPencil size={16} aria-hidden /> Edit course
        </Link>
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href={`/courses/${course.id}/stats`}>
          <IconChartBar size={16} aria-hidden /> Stats
        </Link>
        <Button variant="ghost" size="sm" isPending={busy === "duplicate"}
          onPress={() => run("duplicate", async () => router.push(`/courses/${(await coursesApi.duplicate(course.id)).id}/edit`))}>
          <IconCopy size={16} aria-hidden /> Duplicate
        </Button>
        <AlertDialog isOpen={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
          <Button variant="ghost" size="sm" className="text-danger">
            <IconTrash size={16} aria-hidden /> Delete
          </Button>
          <AlertDialog.Backdrop>
            <AlertDialog.Container>
              <AlertDialog.Dialog>
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>Delete &ldquo;{course.title}&rdquo;?</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p className="m-0">Its lessons, quizzes, images, reviews and every learner&rsquo;s progress are removed for good. This can&rsquo;t be undone.</p>
                  {error && <p className="m-0 mt-2 text-danger" role="alert">{error}</p>}
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button variant="ghost" slot="close" isDisabled={busy === "delete"}>Cancel</Button>
                  <Button variant="danger" isPending={busy === "delete"}
                    onPress={() => run("delete", async () => { await coursesApi.deleteCourse(course.id); router.push("/teach"); })}>
                    Delete course
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>
      </div>
      {error && !isConfirmingDelete && <p className="m-0 text-sm text-danger" role="alert">{error}</p>}
    </Card>
  );
}

/** Start / continue / certificate, depending on where the learner is. */
function LearnerCard({ course, enrollment, isSignedIn, onEnrollment }: {
  course: CourseDetail; enrollment: Enrollment | null; isSignedIn: boolean; onEnrollment: (e: Enrollment | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = course.lesson_count || course.stages.reduce((n, s) => n + s.lessons.length, 0);
  const done = enrollment?.completed_lesson_ids.length ?? 0;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const goToLessons = () => document.getElementById("lesson")?.scrollIntoView({ behavior: "smooth" });

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      onEnrollment(await learningApi.enroll(course.id));
      goToLessons();
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Couldn't start the course. Try again."));
    }
    setBusy(false);
  };

  const leave = async () => {
    if (!window.confirm("Leave this course? Your progress and notes are kept if you come back.")) return;
    await learningApi.leave(course.id).catch(() => undefined);
    onEnrollment(null);
  };

  return (
    <Card className="gap-3 p-5">
      {!isSignedIn ? (
        <>
          <Link className={buttonVariants({ fullWidth: true })} href="/register">Sign up to start</Link>
          <Button variant="outline" fullWidth onPress={goToLessons}>Preview the lessons</Button>
          <p className="m-0 text-xs text-muted">Free. Your progress, notes and certificate need an account.</p>
        </>
      ) : !enrollment ? (
        <>
          <Button fullWidth isPending={busy} onPress={start}>Start course</Button>
          <p className="m-0 text-xs text-muted">Free. Track your progress and get a certificate when you finish.</p>
        </>
      ) : (
        <>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">{enrollment.completed_at ? "Completed" : "Your progress"}</span>
            <span className="text-muted tabular-nums">{done}/{total} lessons</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-default" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
            <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          {enrollment.certificate_code ? (
            <Link className={buttonVariants({ fullWidth: true })} href={`/certificates/${enrollment.certificate_code}`}>
              <IconCertificate size={18} aria-hidden /> View certificate
            </Link>
          ) : (
            <Button fullWidth onPress={goToLessons}>Continue learning</Button>
          )}
          <Button size="sm" variant="ghost" className="self-center text-muted" onPress={leave}>Leave course</Button>
        </>
      )}
      {error && <p className="m-0 text-sm text-danger" role="alert">{error}</p>}
    </Card>
  );
}

/** The course page: what it is, who wrote it, the lessons, reviews and related courses. Server-rendered for
 *  visitors (`initial`); signed-in people then get their own view (progress, drafts, author tools). */
export default function CoursePage({ id, initial }: { id: string; initial: CourseDetail | null }) {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const isSignedIn = Boolean(session);
  const [course, setCourse] = useState<CourseDetail | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [related, setRelated] = useState<CourseListItem[]>([]);

  const load = useCallback(() => coursesApi.courseDetail(id)
    .then((data) => { setCourse(data); setError(null); })
    .catch((failure) => setError(failure?.response?.status === 404 ? "This course doesn't exist, or it's private." : "We couldn't load this course right now.")), [id]);

  // a signed-in person may be its author (drafts, answers) or a learner (progress): fetch their own view
  useEffect(() => {
    if (isSessionPending) return;
    if (isSignedIn || !initial) void load();
  }, [isSessionPending, isSignedIn, initial, load]);

  useEffect(() => {
    if (course?.status === "published") coursesApi.related(course.id).then(setRelated).catch(() => setRelated([]));
  }, [course?.id, course?.status]);

  const setEnrollment = useCallback((enrollment: Enrollment | null) =>
    setCourse((current) => current && { ...current, enrollment }), []);

  if (!course) {
    return error ? (
      <div className="mt-6 flex flex-col gap-6">
        {backLink}
        <Alert status="danger">
          <Alert.Indicator><IconAlertCircle size={20} /></Alert.Indicator>
          <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
        </Alert>
      </div>
    ) : (
      <div className="mt-10 flex items-center justify-center gap-3 py-12 text-muted" role="status"><Spinner size="sm" /> Loading course…</div>
    );
  }

  const intro = getVideoEmbedUrl(course.intro_video_url);
  const canTrack = isSignedIn && !course.is_owner && course.status !== "draft";
  const canReview = canTrack && Boolean(course.enrollment?.completed_lesson_ids.length);
  const facts = [
    LEVELS[course.level],
    plural(course.lesson_count, "lesson"),
    course.estimated_minutes ? `About ${formatMinutes(course.estimated_minutes)}` : null,
    LANGUAGES[course.language],
    course.learner_count ? plural(course.learner_count, "learner") : null,
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <div className="mt-4 flex flex-col gap-10 pb-4">
      <div className="flex flex-col gap-4">
        {backLink}
        {course.is_owner && <OwnerBar course={course} onChange={(updated) => setCourse(updated)} />}
        {course.is_owner && course.is_hidden && (
          <Alert status="warning">
            <Alert.Indicator><IconEyeOff size={20} /></Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Hidden after reports</Alert.Title>
              <Alert.Description>Several people reported this course, so only you can see it until a moderator reviews it.</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </div>

      <section className="grid gap-8 border-b border-separator pb-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <p className="m-0 text-sm font-medium tracking-wide text-accent uppercase">{CATEGORIES[course.category] ?? "Other"}</p>
          <h1 className="m-0 text-[clamp(28px,4vw,42px)] leading-tight font-semibold tracking-tight text-balance [overflow-wrap:anywhere]">{course.title}</h1>
          <p className="m-0 max-w-[65ch] text-lg whitespace-pre-line text-muted">{course.description}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <RatingSummary average={course.rating.average} count={course.rating.count} />
            <span>
              By {course.author ? <Link href={`/authors/${course.author.id}`} className="font-medium">{course.author.name}</Link> : <span className="font-medium">EduHub</span>}
            </span>
            <span className="text-muted">Updated {dateFormat.format(new Date(course.updated_at))}</span>
          </div>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {facts.map((fact) => <li key={fact} className="rounded-full bg-default px-3 py-1 text-sm">{fact}</li>)}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          {/* not before the session is known, so a signed-in learner never sees "Sign up" flash by */}
          {!isSessionPending && !course.is_owner && course.status !== "draft" && (
            <LearnerCard course={course} enrollment={course.enrollment} isSignedIn={isSignedIn} onEnrollment={setEnrollment} />
          )}
          {isSignedIn && !course.is_owner && <div className="self-end"><ReportButton target="course" id={course.id} label="Report course" /></div>}
        </div>
      </section>

      {(intro || course.images.length > 0) && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Preview">
          {intro && (
            <div className="aspect-video overflow-hidden rounded-xl bg-black sm:col-span-2 lg:col-span-2">
              <iframe className="size-full border-0" src={intro} title={`${course.title}: intro video`} allowFullScreen
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" />
            </div>
          )}
          {course.images.slice(0, intro ? 1 : 3).map((image, i) => (
            // plain img: course photos come from the API's media host, which differs per environment
            // eslint-disable-next-line @next/next/no-img-element
            <img key={image.id} className="block aspect-[4/3] w-full rounded-xl bg-surface-secondary object-cover" alt={`${course.title}, image ${i + 1}`} src={image.image} />
          ))}
        </section>
      )}

      {(course.outcomes.length > 0 || course.requirements.length > 0) && (
        <section className="grid gap-6 md:grid-cols-2">
          {course.outcomes.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <h2 className="m-0 text-lg font-semibold">What you&rsquo;ll learn</h2>
              <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                {course.outcomes.map((item) => (
                  <li key={item} className="flex gap-2"><IconCheck size={18} className="mt-0.5 shrink-0 text-success" aria-hidden />{item}</li>
                ))}
              </ul>
            </div>
          )}
          {course.requirements.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <h2 className="m-0 text-lg font-semibold">Before you start</h2>
              <ul className="m-0 mt-3 list-disc pl-5">
                {course.requirements.map((item) => <li key={item} className="mt-1">{item}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      <LessonPlayer course={course} enrollment={course.enrollment} canTrack={canTrack} isSignedIn={isSignedIn} onEnrollment={setEnrollment} />

      {course.status !== "draft" && (
        <Reviews courseId={course.id} canReview={canReview} hasMyReview={course.my_review_id !== null} isOwner={course.is_owner} isSignedIn={isSignedIn} onChanged={() => void load()} />
      )}

      {course.author && (
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="author-heading">
          <h2 id="author-heading" className="m-0 text-sm font-medium text-muted">About the author</h2>
          <p className="m-0 text-lg font-semibold"><Link href={`/authors/${course.author.id}`}>{course.author.name}</Link></p>
          {course.author.headline && <p className="m-0 text-muted">{course.author.headline}</p>}
          {course.author.bio && <p className="m-0 max-w-[70ch] whitespace-pre-line">{course.author.bio}</p>}
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related-heading">
          <h2 id="related-heading" className="m-0 text-2xl font-semibold">More in {CATEGORIES[course.category]}</h2>
          <ul className="m-0 mt-5 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => <li key={item.id}><CourseCard course={item} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
