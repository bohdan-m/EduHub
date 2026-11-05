"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, Drawer } from "@heroui/react";
import {
  IconArrowLeft, IconArrowRight, IconBookmark, IconBookmarkFilled, IconCircleCheckFilled, IconCircle, IconFileText,
  IconListCheck, IconListDetails, IconNotes, IconPhoto, IconPlayerPlay, IconX,
} from "@tabler/icons-react";
import { coursesApi } from "@/api/courses.api";
import { learningApi } from "@/api/learning.api";
import Comments from "@/components/Course/Comments";
import LessonContent from "@/components/Lesson/LessonContent";
import { getApiErrorMessage } from "@/utils/apiError";
import { LIMITS } from "@/utils/validation";
import type { CourseDetail, Enrollment, LessonItem } from "@/utils/types/courses";

const pad = (n: number) => String(n).padStart(2, "0");

type Placed = { lesson: LessonItem; stageIndex: number; lessonIndex: number };

function Curriculum({ course, currentId, completed, bookmarked, onOpen }: {
  course: CourseDetail; currentId: number | undefined; completed: Set<number>; bookmarked: Set<number>; onOpen: (lesson: LessonItem) => void;
}) {
  return (
    <ol className="m-0 list-none p-0">
      {course.stages.map((stage, stageIndex) => (
        <li key={stage.id} className="border-b border-border px-3 pt-3 pb-2 last:border-b-0">
          <h3 className="m-0 flex items-baseline gap-3 px-2 pb-2 text-[15px] font-semibold">
            <span className="text-accent tabular-nums">{pad(stageIndex + 1)}</span>
            <span className="[overflow-wrap:anywhere]">{stage.title}</span>
          </h3>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {stage.lessons.map((lesson, lessonIndex) => {
              const isCurrent = currentId === lesson.id;
              const isDone = completed.has(lesson.id);
              const has = (type: string) => lesson.blocks.some((b) => b.type === type);
              return (
                <li key={lesson.id}>
                  <button
                    type="button"
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={() => onOpen(lesson)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors ${isCurrent ? "bg-accent-soft text-accent-soft-foreground" : "hover:bg-surface-secondary"}`}
                  >
                    {isDone
                      ? <IconCircleCheckFilled size={16} className="shrink-0 text-success" aria-label="Completed" />
                      : <span className="w-4 shrink-0 text-center text-[11px] text-muted tabular-nums" aria-hidden>{stageIndex + 1}.{lessonIndex + 1}</span>}
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{lesson.title}</span>
                    {bookmarked.has(lesson.id) && <IconBookmarkFilled size={14} className="shrink-0 text-accent" aria-label="Bookmarked" />}
                    {has("video") && <IconPlayerPlay size={14} className="shrink-0 text-muted" aria-label="Has video" />}
                    {has("image") && <IconPhoto size={14} className="shrink-0 text-muted" aria-label="Has images" />}
                    {has("file") && <IconFileText size={14} className="shrink-0 text-muted" aria-label="Has files" />}
                    {has("quiz") && <IconListCheck size={14} className="shrink-0 text-muted" aria-label="Has a quiz" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/** The learner's private notes on a lesson, saved a moment after they stop typing. */
function Notes({ courseId, lessonId, initial, onSaved }: { courseId: number; lessonId: number; initial: string; onSaved: (e: Enrollment) => void }) {
  const [note, setNote] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const saved = useRef(initial);

  useEffect(() => {
    if (note === saved.current) return;
    const timer = setTimeout(() => {
      setStatus("saving");
      learningApi.updateProgress(courseId, lessonId, { note })
        .then((result) => { saved.current = note; setStatus("saved"); onSaved(result.enrollment); })
        .catch(() => setStatus("failed"));
    }, 800);
    return () => clearTimeout(timer);
  }, [note, courseId, lessonId, onSaved]);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`note-${lessonId}`} className="text-sm font-medium">My notes <span className="font-normal text-muted">· only you see them</span></label>
      <textarea id={`note-${lessonId}`} rows={4} maxLength={LIMITS.note} value={note} onChange={(event) => setNote(event.target.value)}
        className="w-full rounded-xl border border-border bg-field px-3 py-2 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30" />
      <p className="m-0 text-xs text-muted" role="status">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "failed" ? "Couldn't save. It's retried as you type." : ""}
      </p>
    </div>
  );
}

type PlayerProps = {
  course: CourseDetail;
  enrollment: Enrollment | null;
  /** signed in, not the author, and the course is live: progress can be saved */
  canTrack: boolean;
  isSignedIn: boolean;
  onEnrollment: (enrollment: Enrollment) => void;
};

function LessonPlayer({ course, enrollment, canTrack, isSignedIn, onEnrollment }: PlayerProps) {
  const lessons: Placed[] = course.stages.flatMap((stage, stageIndex) =>
    stage.lessons.map((lesson, lessonIndex) => ({ lesson, stageIndex, lessonIndex })));
  // the open lesson lives in ?lesson=<id>, so a lesson can be linked to and survives a reload;
  // without one, the learner continues where they stopped
  const linked = Number(useSearchParams().get("lesson")) || null;
  const [picked, setPicked] = useState<number | null>(null);
  const lessonId = picked ?? linked ?? enrollment?.last_lesson_id ?? null;
  const [isCurriculumOpen, setIsCurriculumOpen] = useState(false);
  const [note, setNote] = useState<{ lessonId: number; text: string } | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const position = Math.max(0, lessons.findIndex((p) => p.lesson.id === lessonId));
  const current = lessons[position];
  const previous = lessons[position - 1];
  const next = lessons[position + 1];
  const completed = new Set(enrollment?.completed_lesson_ids ?? []);
  const bookmarked = new Set(enrollment?.bookmarked_lesson_ids ?? []);
  const isEnrolled = Boolean(enrollment);
  const currentId = current?.lesson.id;

  // opening a lesson of a course you take remembers it as where you are; notes load with it
  useEffect(() => {
    if (!currentId || !canTrack || !isEnrolled) return;
    learningApi.updateProgress(course.id, currentId, {}).then((result) => onEnrollment(result.enrollment)).catch(() => undefined);
    learningApi.lessonProgress(course.id, currentId).then((p) => setNote({ lessonId: currentId, text: p.note })).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, canTrack, isEnrolled, course.id]);

  const open = (lesson: LessonItem) => {
    setPicked(lesson.id);
    setIsCurriculumOpen(false);
    setShowNotes(false);
    window.history.replaceState(null, "", `?lesson=${lesson.id}`);
    document.getElementById("lesson")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const update = async (changes: { completed?: boolean; bookmarked?: boolean }, then?: () => void) => {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const result = await learningApi.updateProgress(course.id, current.lesson.id, changes);
      onEnrollment(result.enrollment);
      then?.();
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Couldn't save your progress. Try again."));
    }
    setBusy(false);
  };

  if (!current) {
    return <p className="m-0 rounded-xl border border-dashed border-border-tertiary px-6 py-12 text-center text-muted">This course has no lessons yet.</p>;
  }

  const isDone = completed.has(current.lesson.id);
  const isMarked = bookmarked.has(current.lesson.id);
  const doneCount = lessons.filter((p) => completed.has(p.lesson.id)).length;
  const curriculum = <Curriculum course={course} currentId={currentId} completed={completed} bookmarked={bookmarked} onOpen={open} />;

  return (
    <section className="grid scroll-mt-4 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start" id="lesson" aria-label="Lessons">
      <div className="flex min-w-0 flex-col gap-6">
        <article className="min-w-0">
          <Card className="gap-0 p-5 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="m-0 text-sm text-muted">
                {course.stages[current.stageIndex].title} · Lesson {current.stageIndex + 1}.{current.lessonIndex + 1} of {lessons.length}
              </p>
              {canTrack && (
                <Button size="sm" variant="ghost" isIconOnly aria-pressed={isMarked} isDisabled={busy}
                  aria-label={isMarked ? "Remove bookmark" : "Bookmark this lesson"} onPress={() => update({ bookmarked: !isMarked })}>
                  {isMarked ? <IconBookmarkFilled size={18} className="text-accent" aria-hidden /> : <IconBookmark size={18} aria-hidden />}
                </Button>
              )}
            </div>
            <h2 className="m-0 mt-1 mb-6 text-2xl font-semibold [overflow-wrap:anywhere]">{current.lesson.title}</h2>
            <LessonContent
              key={current.lesson.id}
              blocks={current.lesson.blocks}
              quizResults={enrollment?.quiz_results}
              grade={async (quiz, answer) => {
                const result = await coursesApi.checkQuiz(course.id, current.lesson.id, quiz.id, answer);
                if (enrollment) onEnrollment({ ...enrollment, quiz_results: { ...enrollment.quiz_results, [quiz.id]: result.correct } });
                return result;
              }}
            />

            {canTrack && showNotes && note?.lessonId === current.lesson.id && (
              <div className="mt-8 border-t border-separator pt-5">
                <Notes courseId={course.id} lessonId={current.lesson.id} initial={note.text} onSaved={onEnrollment} />
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 border-t border-separator pt-5">
              {canTrack && (
                <div className="flex flex-wrap items-center gap-2">
                  {isDone ? (
                    <Button variant="outline" isDisabled={busy} onPress={() => update({ completed: false })}>
                      <IconCircleCheckFilled size={18} className="text-success" aria-hidden />
                      Completed · undo
                    </Button>
                  ) : next ? (
                    <Button isPending={busy} onPress={() => update({ completed: true }, () => open(next.lesson))}>
                      <IconCircle size={18} aria-hidden />
                      Complete and continue
                    </Button>
                  ) : (
                    <Button isPending={busy} onPress={() => update({ completed: true })}>
                      <IconCircle size={18} aria-hidden />
                      Mark as complete
                    </Button>
                  )}
                  {isEnrolled && (
                    <Button variant="ghost" onPress={() => setShowNotes((shown) => !shown)} aria-expanded={showNotes}>
                      <IconNotes size={18} aria-hidden />
                      {showNotes ? "Hide notes" : "Notes"}
                    </Button>
                  )}
                  <span className="ml-auto text-sm text-muted tabular-nums" role="status">{doneCount} of {lessons.length} done</span>
                </div>
              )}
              {!isSignedIn && <p className="m-0 text-sm text-muted">Log in to save your progress, take notes and get a certificate.</p>}
              {error && <p className="m-0 text-sm text-danger" role="alert">{error}</p>}
              <nav className="flex flex-wrap justify-between gap-3" aria-label="Lesson navigation">
                {previous ? (
                  <Button variant="ghost" onPress={() => open(previous.lesson)}>
                    <IconArrowLeft size={16} aria-hidden />
                    <span className="max-w-[24ch] truncate">{previous.lesson.title}</span>
                  </Button>
                ) : <span />}
                {next && (
                  <Button variant={canTrack && !isDone ? "ghost" : "primary"} onPress={() => open(next.lesson)}>
                    <span className="max-w-[24ch] truncate">Next: {next.lesson.title}</span>
                    <IconArrowRight size={16} aria-hidden />
                  </Button>
                )}
              </nav>
            </div>
          </Card>
        </article>
        <Comments key={current.lesson.id} courseId={course.id} lessonId={current.lesson.id} isSignedIn={isSignedIn} isDraft={course.status === "draft"} />
      </div>

      <Card className="hidden gap-0 p-0 lg:sticky lg:top-4 lg:flex">
        <h2 className="m-0 flex items-center justify-between border-b border-border px-5 py-4 text-base font-semibold">
          Curriculum
          {isEnrolled && <span className="text-sm font-normal text-muted tabular-nums">{doneCount}/{lessons.length}</span>}
        </h2>
        <div className="max-h-[70vh] overflow-y-auto">{curriculum}</div>
      </Card>

      {/* on phones and tablets the curriculum slides in from a button that stays at the bottom of the screen */}
      <div className="sticky bottom-4 z-10 flex justify-center lg:hidden">
        <Drawer isOpen={isCurriculumOpen} onOpenChange={setIsCurriculumOpen}>
          <Drawer.Trigger className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
            <IconListDetails size={18} aria-hidden />
            Lessons · {position + 1} of {lessons.length}
          </Drawer.Trigger>
          <Drawer.Backdrop>
            <Drawer.Content placement="bottom">
              <Drawer.Dialog aria-label="Curriculum" className="max-h-[80dvh]">
                <Drawer.Header>
                  <Drawer.Heading className="text-base font-semibold">Curriculum {isEnrolled && `· ${doneCount}/${lessons.length} done`}</Drawer.Heading>
                  <Drawer.CloseTrigger><IconX size={16} /></Drawer.CloseTrigger>
                </Drawer.Header>
                <Drawer.Body className="overflow-y-auto p-0">{curriculum}</Drawer.Body>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>
      </div>
    </section>
  );
}

export default LessonPlayer;
