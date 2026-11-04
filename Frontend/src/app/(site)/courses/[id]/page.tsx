"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertDialog, Alert, Button, Card, Spinner, buttonVariants } from "@heroui/react";
import {
  IconAlertCircle, IconArrowLeft, IconArrowRight, IconListCheck, IconPencil, IconPlayerPlay, IconTrash,
} from "@tabler/icons-react";
import { coursesApi } from "@/api/courses.api";
import LessonContent from "@/components/Lesson/LessonContent";
import { getApiErrorMessage } from "@/utils/apiError";
import type { CourseDetail, LessonItem } from "@/utils/types/courses";

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });
const pad = (n: number) => String(n).padStart(2, "0");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type Placed = { lesson: LessonItem; stageIndex: number; lessonIndex: number };

const backLink = (
  <Link className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2 self-start text-muted" })} href="/home">
    <IconArrowLeft size={16} aria-hidden />
    All courses
  </Link>
);

// the open lesson lives in ?lesson=<id>, so a lesson can be linked to and survives a reload
function lessonFromUrl() {
  return Number(new URLSearchParams(window.location.search).get("lesson")) || null;
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    coursesApi.courseDetail(id)
      .then((data) => {
        setCourse(data);
        setLessonId(lessonFromUrl());
      })
      .catch((fetchError) => {
        console.error(fetchError);
        setError(fetchError?.response?.status === 404 ? "This course doesn't exist." : "We couldn't load this course right now.");
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="mt-10 flex items-center justify-center gap-3 py-12 text-muted" role="status">
        <Spinner size="sm" />
        Loading course…
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="mt-6 flex flex-col gap-6">
        {backLink}
        <Alert status="danger">
          <Alert.Indicator><IconAlertCircle size={20} /></Alert.Indicator>
          <Alert.Content><Alert.Description>{error ?? "This course doesn't exist."}</Alert.Description></Alert.Content>
        </Alert>
      </div>
    );
  }

  const lessons: Placed[] = course.stages.flatMap((stage, stageIndex) =>
    stage.lessons.map((lesson, lessonIndex) => ({ lesson, stageIndex, lessonIndex })));
  const position = Math.max(0, lessons.findIndex((p) => p.lesson.id === lessonId));
  const current = lessons[position];
  const previous = lessons[position - 1];
  const next = lessons[position + 1];

  const open = (lesson: LessonItem) => {
    setLessonId(lesson.id);
    window.history.replaceState(null, "", `?lesson=${lesson.id}`);
    document.getElementById("lesson")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const deleteCourse = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await coursesApi.deleteCourse(course.id);
      router.push("/home");
    } catch (deleteFailure) {
      setDeleteError(getApiErrorMessage(deleteFailure, "Couldn't delete the course. Try again."));
      setIsDeleting(false);
    }
  };

  const quizCount = lessons.reduce((sum, p) => sum + p.lesson.blocks.filter((b) => b.type === "quiz").length, 0);

  return (
    <div className="mt-4 flex flex-col gap-10 pb-4">
      <section className="flex flex-col gap-6 border-b border-separator pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {backLink}
          {course.is_owner && (
            <div className="flex gap-2">
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/courses/${course.id}/edit`}>
                <IconPencil size={16} aria-hidden />
                Edit course
              </Link>
              <AlertDialog isOpen={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
                <Button variant="ghost" size="sm" className="text-danger">
                  <IconTrash size={16} aria-hidden />
                  Delete
                </Button>
                <AlertDialog.Backdrop>
                  <AlertDialog.Container>
                    <AlertDialog.Dialog>
                      <AlertDialog.Header>
                        <AlertDialog.Icon status="danger" />
                        <AlertDialog.Heading>Delete &ldquo;{course.title}&rdquo;?</AlertDialog.Heading>
                      </AlertDialog.Header>
                      <AlertDialog.Body>
                        <p className="m-0">Its stages, lessons, quizzes and cover images are removed for good. This can&rsquo;t be undone.</p>
                        {deleteError && <p className="m-0 mt-2 text-danger" role="alert">{deleteError}</p>}
                      </AlertDialog.Body>
                      <AlertDialog.Footer>
                        <Button variant="ghost" slot="close" isDisabled={isDeleting}>Cancel</Button>
                        <Button variant="danger" onPress={deleteCourse} isPending={isDeleting}>Delete course</Button>
                      </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                  </AlertDialog.Container>
                </AlertDialog.Backdrop>
              </AlertDialog>
            </div>
          )}
        </div>
        <div className="grid gap-6 md:grid-cols-[1fr_minmax(240px,300px)] md:items-start md:gap-10">
          <div>
            <h1 className="m-0 text-[clamp(28px,4vw,40px)] font-semibold leading-tight tracking-tight text-balance [overflow-wrap:anywhere]">{course.title}</h1>
            {course.description && <p className="m-0 mt-3 max-w-[65ch] whitespace-pre-line text-muted">{course.description}</p>}
          </div>
          <dl className="m-0 grid grid-cols-3 gap-4 rounded-xl border border-border bg-surface p-4 md:grid-cols-1 md:gap-3 md:p-5">
            {[
              ["Author", course.author?.name ?? "EduHub"],
              ["Created", dateFormat.format(new Date(course.created_at))],
              ["Content", [plural(course.stages.length, "stage"), plural(lessons.length, "lesson"), quizCount ? `${quizCount} ${quizCount === 1 ? "quiz" : "quizzes"}` : ""].filter(Boolean).join(" · ")],
            ].map(([label, value]) => (
              <div key={label} className="flex min-w-0 flex-col gap-0.5 md:flex-row md:items-baseline md:justify-between md:gap-4">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="m-0 text-[15px] font-medium [overflow-wrap:anywhere] md:text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {course.images.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {course.images.map((image, i) => (
            <li key={image.id}>
              {/* plain img: course photos come from the API's media host, which differs per environment */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="block aspect-[4/3] w-full rounded-lg bg-surface-secondary object-cover" alt={`${course.title}, image ${i + 1}`} src={image.image} />
            </li>
          ))}
        </ul>
      )}

      <section className="grid scroll-mt-4 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start" id="lesson">
        <article className="min-w-0">
          {current ? (
            <Card className="gap-0 p-5 sm:p-8">
              <p className="m-0 text-sm text-muted">
                {course.stages[current.stageIndex].title} · Lesson {current.stageIndex + 1}.{current.lessonIndex + 1} of {lessons.length}
              </p>
              <h2 className="m-0 mt-1 mb-6 text-2xl font-semibold [overflow-wrap:anywhere]">{current.lesson.title}</h2>
              <LessonContent
                key={current.lesson.id}
                blocks={current.lesson.blocks}
                grade={(quiz, selected) => coursesApi.checkQuiz(course.id, current.lesson.id, quiz.id, selected)}
              />
              <nav className="mt-8 flex flex-wrap justify-between gap-3 border-t border-separator pt-5" aria-label="Lesson navigation">
                {previous ? (
                  <Button variant="ghost" onPress={() => open(previous.lesson)}>
                    <IconArrowLeft size={16} aria-hidden />
                    <span className="max-w-[24ch] truncate">{previous.lesson.title}</span>
                  </Button>
                ) : <span />}
                {next && (
                  <Button onPress={() => open(next.lesson)}>
                    <span className="max-w-[24ch] truncate">Next: {next.lesson.title}</span>
                    <IconArrowRight size={16} aria-hidden />
                  </Button>
                )}
              </nav>
            </Card>
          ) : (
            <p className="m-0 rounded-xl border border-dashed border-border-tertiary px-6 py-12 text-center text-muted">This course has no lessons yet.</p>
          )}
        </article>

        <Card className="gap-0 p-0 lg:sticky lg:top-4">
          <h2 className="m-0 border-b border-border px-5 py-4 text-base font-semibold">Curriculum</h2>
          <ol className="m-0 max-h-[70vh] list-none overflow-y-auto p-0">
            {course.stages.map((stage, stageIndex) => (
              <li key={stage.id} className="border-b border-border px-3 pt-3 pb-2 last:border-b-0">
                <h3 className="m-0 flex items-baseline gap-3 px-2 pb-2 text-[15px] font-semibold">
                  <span className="text-accent tabular-nums">{pad(stageIndex + 1)}</span>
                  <span className="[overflow-wrap:anywhere]">{stage.title}</span>
                </h3>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {stage.lessons.map((lesson, lessonIndex) => {
                    const isCurrent = current?.lesson.id === lesson.id;
                    const hasVideo = lesson.blocks.some((b) => b.type === "video");
                    const hasQuiz = lesson.blocks.some((b) => b.type === "quiz");
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          aria-current={isCurrent ? "true" : undefined}
                          onClick={() => open(lesson)}
                          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors ${isCurrent ? "bg-accent-soft text-accent-soft-foreground" : "hover:bg-surface-secondary"}`}
                        >
                          <span className="w-7 shrink-0 text-xs text-muted tabular-nums">{stageIndex + 1}.{lessonIndex + 1}</span>
                          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{lesson.title}</span>
                          {hasVideo && <IconPlayerPlay size={14} className="shrink-0 text-muted" aria-label="Has video" />}
                          {hasQuiz && <IconListCheck size={14} className="shrink-0 text-muted" aria-label="Has a quiz" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </Card>
      </section>
    </div>
  );
}
