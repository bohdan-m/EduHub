"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Tabs, buttonVariants } from "@heroui/react";
import {
  IconAlertCircle, IconArrowDown, IconArrowUp, IconCopy, IconFileDescription, IconPlus, IconTrash, IconX,
} from "@tabler/icons-react";
import { coursesApi } from "@/api/courses.api";
import BlockEditor, { BLOCK_TYPES, Field } from "@/components/CourseBuilder/BlockEditor";
import LessonContent from "@/components/Lesson/LessonContent";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  buildCoursePayload, createBlock, createId, draftFromCourse, duplicateLesson, emptyDetails, emptyDraft, emptyLesson, emptyStage,
  findProblems, type CourseDraft, type DraftLesson, type DraftStage,
} from "@/utils/courseForm";
import { CATEGORIES, LANGUAGES, LEVELS, STATUSES } from "@/utils/courseMeta";
import type { Block, BlockType, CourseDetail, CourseDetailsInput, CourseImage } from "@/utils/types/courses";
import { draftsApi } from "@/api/drafts.api";
import { LIMITS, validateImages, validateText, validateVideoUrl } from "@/utils/validation";

const pad = (n: number) => String(n).padStart(2, "0");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function move<T>(items: T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** A labelled native select: short fixed lists, fully keyboard and screen-reader friendly. */
function SelectField<T extends string>({ label, value, options, onChange, hint }: {
  label: string; value: T; options: Record<T, string>; onChange: (value: T) => void; hint?: string;
}) {
  const id = `field-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as T)}
        className="h-10 rounded-xl border border-border bg-field px-3 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30">
        {(Object.entries(options) as [T, string][]).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
      {hint && <p className="m-0 text-xs text-muted">{hint}</p>}
    </div>
  );
}

type Selection = { kind: "details" } | { kind: "stage"; stageKey: string } | { kind: "lesson"; stageKey: string; lessonKey: string };

// Create and edit share this: an outline on the left, the selected part on the right, one save for the whole course
const savedTime = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export interface RestoredDraft { draft: CourseDraft; savedAt: string }

type DraftStatus = "idle" | "saving" | "saved" | "failed";

// `restored`: the author's draft from the server (work left unsaved on any device), loaded by the page
function CourseBuilder({ course, restored: initialDraft = null }: { course?: CourseDetail; restored?: RestoredDraft | null }) {
  const router = useRouter();
  const [restored, setRestored] = useState(initialDraft);
  const original = () => (course ? draftFromCourse(course) : emptyDraft());
  const [draft, setDraftState] = useState<CourseDraft>(() => restored?.draft ?? original());
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  // changes made vs changes the server has; anything between them would be lost by closing the tab
  const [changeCount, setChangeCount] = useState(0);
  const [storedCount, setStoredCount] = useState(0);
  // draft saves run one after another, so a slow older save can never overwrite a newer one
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const [selection, setSelection] = useState<Selection>({ kind: "details" });
  const [keptImages, setKeptImages] = useState<CourseImage[]>(course?.images ?? []);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [isDirty, setIsDirty] = useState(Boolean(restored));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const selectionKey = selection.kind === "details" ? "details" : selection.kind === "stage" ? selection.stageKey : selection.lessonKey;
  const isFirstSelection = useRef(true);

  // on narrow screens the panel sits under the outline, so bring the opened part into view
  useEffect(() => {
    if (isFirstSelection.current) {
      isFirstSelection.current = false;
      return;
    }
    if (window.matchMedia("(max-width: 1023px)").matches) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectionKey]);

  const details = draft.details ?? emptyDetails();
  const isPublishing = details.status !== "draft";
  const problems = useMemo(() => findProblems(draft, { publishing: isPublishing }), [draft, isPublishing]);
  const problemTargets = useMemo(() => new Set(problems.map((p) => p.target)), [problems]);
  const hasProblem = (target: string) => showErrors && problemTargets.has(target);

  // every change is saved as a draft on the server a second after typing stops, so it follows the author anywhere
  useEffect(() => {
    if (!isDirty || isSaving || changeCount === storedCount) return;
    const version = changeCount;
    const timer = setTimeout(() => {
      setDraftStatus("saving");
      saveChain.current = saveChain.current.then(() => draftsApi.save(draft, course?.id)
        .then((saved) => {
          setStoredCount((stored) => Math.max(stored, version));
          setDraftSavedAt(saved.updated_at);
          setDraftStatus("saved");
        })
        .catch(() => setDraftStatus("failed")));
    }, 1000);
    return () => clearTimeout(timer);
  }, [draft, isDirty, isSaving, changeCount, storedCount, course?.id]);

  // the save bar is fixed to the bottom: keep focused or scrolled-to fields above it, not hidden behind it
  useEffect(() => {
    const root = document.documentElement;
    root.style.scrollPaddingBottom = "8rem";
    return () => {
      root.style.scrollPaddingBottom = "";
    };
  }, []);

  // leaving asks first while the server doesn't have the latest changes yet, or picked images (never in drafts) would be lost
  const hasUnstoredWork = (isDirty && changeCount !== storedCount) || newImages.length > 0;
  useEffect(() => {
    if (!hasUnstoredWork || isSaving) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnstoredWork, isSaving]);

  const discardDraft = () => {
    saveChain.current = saveChain.current.then(() => draftsApi.remove(course?.id)).catch(() => undefined);
    setStoredCount(changeCount);
    setDraftStatus("idle");
    setDraftState(original());
    setRestored(null);
    setIsDirty(false);
    setShowErrors(false);
    setSelection({ kind: "details" });
  };

  const setDraft = (update: (current: CourseDraft) => CourseDraft) => {
    setDraftState(update);
    setIsDirty(true);
    setChangeCount((count) => count + 1);
  };
  const updateStage = (stageKey: string, update: (stage: DraftStage) => DraftStage) =>
    setDraft((d) => ({ ...d, stages: d.stages.map((s) => (s.key === stageKey ? update(s) : s)) }));
  const updateLesson = (stageKey: string, lessonKey: string, update: (lesson: DraftLesson) => DraftLesson) =>
    updateStage(stageKey, (s) => ({ ...s, lessons: s.lessons.map((l) => (l.key === lessonKey ? update(l) : l)) }));
  const setDetails = (patch: Partial<CourseDetailsInput>) => setDraft((d) => ({ ...d, details: { ...(d.details ?? emptyDetails()), ...patch } }));
  // lists are edited one item per line; blank lines are dropped on save
  const lines = (items: string[]) => items.join("\n");
  const toItems = (text: string) => text.split("\n").slice(0, LIMITS.listItems + 1);

  const addStage = () => {
    const stage = emptyStage();
    setDraft((d) => ({ ...d, stages: [...d.stages, stage] }));
    setSelection({ kind: "lesson", stageKey: stage.key, lessonKey: stage.lessons[0].key });
  };
  const addLesson = (stageKey: string) => {
    const lesson = emptyLesson();
    updateStage(stageKey, (s) => ({ ...s, lessons: [...s.lessons, lesson] }));
    setSelection({ kind: "lesson", stageKey, lessonKey: lesson.key });
    setIsPreview(false);
  };
  const removeStage = (stageKey: string) => {
    setDraft((d) => ({ ...d, stages: d.stages.filter((s) => s.key !== stageKey) }));
    setSelection({ kind: "details" });
  };
  const copyLesson = (stageKey: string, source: DraftLesson) => {
    const copy = duplicateLesson(source);
    updateStage(stageKey, (s) => {
      const at = s.lessons.findIndex((l) => l.key === source.key);
      return { ...s, lessons: [...s.lessons.slice(0, at + 1), copy, ...s.lessons.slice(at + 1)] };
    });
    setSelection({ kind: "lesson", stageKey, lessonKey: copy.key });
  };
  const removeLesson = (stageKey: string, lessonKey: string) => {
    updateStage(stageKey, (s) => ({ ...s, lessons: s.lessons.filter((l) => l.key !== lessonKey) }));
    setSelection({ kind: "stage", stageKey });
  };

  const openTarget = (target: string) => {
    if (target === "details") return setSelection({ kind: "details" });
    for (const stage of draft.stages) {
      if (stage.key === target) return setSelection({ kind: "stage", stageKey: stage.key });
      const lesson = stage.lessons.find((l) => l.key === target);
      if (lesson) {
        setIsPreview(false);
        return setSelection({ kind: "lesson", stageKey: stage.key, lessonKey: lesson.key });
      }
    }
  };

  const save = async () => {
    setShowErrors(true);
    setSaveError(null);
    if (problems.length > 0 || imageError) return;
    setIsSaving(true);
    try {
      const payload = buildCoursePayload(draft);
      const saved = course
        ? await coursesApi.updateCourse(course.id, payload, keptImages.map((image) => image.id), newImages)
        : await coursesApi.createCourse(payload, newImages);
      setIsDirty(false);
      // the course has it all now; wait for any draft save still running so it can't bring the draft back
      await saveChain.current;
      await draftsApi.remove(course?.id).catch(() => undefined);
      router.push(`/courses/${saved.id}`);
    } catch (error) {
      setSaveError(getApiErrorMessage(error, "Couldn't save the course. Check the details and try again."));
      setIsSaving(false);
    }
  };

  const stage = selection.kind !== "details" ? draft.stages.find((s) => s.key === selection.stageKey) : undefined;
  const lesson = selection.kind === "lesson" ? stage?.lessons.find((l) => l.key === selection.lessonKey) : undefined;
  const stageIndex = stage ? draft.stages.indexOf(stage) : -1;
  const lessonCount = draft.stages.reduce((sum, s) => sum + s.lessons.length, 0);
  const imageCount = keptImages.length + newImages.length;

  const outlineItem = (isActive: boolean, isFlagged: boolean) =>
    `flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
      isActive ? "bg-accent-soft font-medium text-accent-soft-foreground" : "hover:bg-surface-secondary"
    } ${isFlagged ? "text-danger" : ""}`;
  const flag = (target: string) =>
    hasProblem(target) && <span className="size-2 shrink-0 rounded-full bg-danger" aria-label="Needs attention" />;

  const outline = (
    <Card className="gap-1 p-2 lg:sticky lg:top-4">
      <button type="button" className={outlineItem(selection.kind === "details", hasProblem("details"))} onClick={() => setSelection({ kind: "details" })}
        aria-label="Course details" aria-current={selection.kind === "details" ? "true" : undefined}>
        <IconFileDescription size={16} className="shrink-0" aria-hidden />
        <span className="flex-1">Course details</span>
        {flag("details")}
      </button>
      <div className="my-1 border-t border-separator" />
      <ol className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Curriculum">
        {draft.stages.map((s, si) => (
          <li key={s.key}>
            <button type="button" className={outlineItem(selection.kind === "stage" && selection.stageKey === s.key, hasProblem(s.key))}
              aria-label={`Stage ${si + 1}: ${s.title.trim() || "Untitled stage"}`}
              aria-current={selection.kind === "stage" && selection.stageKey === s.key ? "true" : undefined}
              onClick={() => setSelection({ kind: "stage", stageKey: s.key })}>
              <span className="w-5 shrink-0 font-semibold text-accent tabular-nums">{pad(si + 1)}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{s.title.trim() || "Untitled stage"}</span>
              {flag(s.key)}
            </button>
            <ol className="m-0 ml-4 flex list-none flex-col gap-0.5 border-l border-separator p-0 pl-2">
              {s.lessons.map((l, li) => (
                <li key={l.key}>
                  <button type="button"
                    className={outlineItem(selection.kind === "lesson" && selection.lessonKey === l.key, hasProblem(l.key))}
                    aria-current={selection.kind === "lesson" && selection.lessonKey === l.key ? "true" : undefined}
                    aria-label={`Lesson ${si + 1}.${li + 1}: ${l.title.trim() || "Untitled lesson"}`}
                    onClick={() => openTarget(l.key)}>
                    <span className="w-7 shrink-0 text-xs text-muted tabular-nums">{si + 1}.{li + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{l.title.trim() || "Untitled lesson"}</span>
                    {flag(l.key)}
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-muted hover:bg-surface-secondary hover:text-foreground"
                  onClick={() => addLesson(s.key)}>
                  <IconPlus size={14} aria-hidden />
                  Add lesson
                </button>
              </li>
            </ol>
          </li>
        ))}
      </ol>
      <Button variant="ghost" size="sm" className="mt-1 justify-start" onPress={addStage}>
        <IconPlus size={16} aria-hidden />
        Add stage
      </Button>
    </Card>
  );

  const reorderButtons = (label: string, index: number, count: number, onMove: (offset: -1 | 1) => void, onRemove?: () => void) => (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="sm" isIconOnly aria-label={`Move ${label} up`} isDisabled={index === 0} onPress={() => onMove(-1)}>
        <IconArrowUp size={16} aria-hidden />
      </Button>
      <Button variant="ghost" size="sm" isIconOnly aria-label={`Move ${label} down`} isDisabled={index === count - 1} onPress={() => onMove(1)}>
        <IconArrowDown size={16} aria-hidden />
      </Button>
      {onRemove && (
        <Button variant="ghost" size="sm" isIconOnly aria-label={`Delete ${label}`} onPress={onRemove}>
          <IconTrash size={16} aria-hidden />
        </Button>
      )}
    </div>
  );

  let panel;
  if (selection.kind === "details" || !stage) {
    panel = (
      <Card className="gap-5 p-5 sm:p-6">
        <h2 className="m-0 text-lg font-semibold">Course details</h2>
        <Field label="Title" value={draft.title} onChange={(title) => setDraft((d) => ({ ...d, title }))} isRequired maxLength={LIMITS.courseTitle}
          error={showErrors ? validateText(draft.title, "Course title", LIMITS.courseTitle) : null} placeholder="Product Design Foundations" />
        <Field label="Description" rows={4} value={draft.description} onChange={(description) => setDraft((d) => ({ ...d, description }))} isRequired
          maxLength={LIMITS.courseDescription} error={showErrors ? validateText(draft.description, "Description", LIMITS.courseDescription) : null}
          placeholder="What learners will be able to do, and who the course is for." />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Category" value={details.category} options={CATEGORIES} onChange={(category) => setDetails({ category })} />
          <SelectField label="Level" value={details.level} options={LEVELS} onChange={(level) => setDetails({ level })} />
          <SelectField label="Language" value={details.language} options={LANGUAGES} onChange={(language) => setDetails({ language })} />
        </div>
        <Field label="What learners will learn (optional)" rows={4} value={lines(details.outcomes)} onChange={(text) => setDetails({ outcomes: toItems(text) })}
          description={`One per line, up to ${LIMITS.listItems}. Shown at the top of the course page.`}
          error={showErrors ? problems.find((p) => p.message.startsWith("What learners"))?.message : null}
          placeholder={"Write SELECT queries with filters\nJoin two tables\nSpot slow queries"} />
        <Field label="Requirements (optional)" rows={3} value={lines(details.requirements)} onChange={(text) => setDetails({ requirements: toItems(text) })}
          description="What learners need before starting, one per line."
          error={showErrors ? problems.find((p) => p.message.startsWith("Requirements"))?.message : null}
          placeholder={"A laptop\nNo programming experience needed"} />
        <Field label="Intro video (optional)" type="url" value={details.intro_video_url} onChange={(intro_video_url) => setDetails({ intro_video_url })}
          description="A short YouTube or Vimeo trailer shown on the course page."
          error={showErrors ? validateVideoUrl(details.intro_video_url) : null} placeholder="https://www.youtube.com/watch?v=…" />
        <SelectField label="Visibility" value={details.status} onChange={(status) => setDetails({ status })}
          options={{ draft: STATUSES.draft.label, unlisted: STATUSES.unlisted.label, published: STATUSES.published.label }}
          hint={`${STATUSES[details.status].hint}${details.status !== "draft" ? " Every lesson needs some content." : ""}`} />
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm font-medium">Cover images <span className="font-normal text-muted">(optional, up to {LIMITS.images})</span></p>
          {(keptImages.length > 0 || newImages.length > 0) && (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {keptImages.map((image, i) => (
                <li key={image.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.image} alt={`Cover ${i + 1}`} className="block size-20 rounded-lg object-cover" />
                  <button type="button" aria-label={`Remove cover ${i + 1}`}
                    className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-border bg-surface shadow-sm hover:bg-surface-secondary"
                    onClick={() => { setKeptImages((list) => list.filter((x) => x.id !== image.id)); setIsDirty(true); }}>
                    <IconX size={12} aria-hidden />
                  </button>
                </li>
              ))}
              {newImages.map((file) => (
                <li key={`${file.name}-${file.size}`} className="flex size-20 items-center justify-center rounded-lg border border-dashed border-border-tertiary p-1 text-center text-xs text-muted [overflow-wrap:anywhere]">
                  {file.name}
                </li>
              ))}
            </ul>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            aria-label="Add cover images"
            aria-invalid={imageError ? true : undefined}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setNewImages(files);
              setIsDirty(true);
              setImageError(validateImages(files) ?? (keptImages.length + files.length > LIMITS.images ? `Keep the total to ${LIMITS.images} images.` : null));
            }}
            className="block w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-default file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-surface-tertiary"
          />
          <p className={`m-0 text-xs ${imageError ? "text-danger" : "text-muted"}`} role={imageError ? "alert" : undefined}>
            {imageError ?? `${imageCount} of ${LIMITS.images} · 5 MB each · course cards show the first three.`}
          </p>
        </div>
      </Card>
    );
  } else if (!lesson) {
    panel = (
      <Card className="gap-5 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <h2 className="m-0 flex-1 text-lg font-semibold">Stage {stageIndex + 1}</h2>
          {reorderButtons(`stage ${stageIndex + 1}`, stageIndex, draft.stages.length,
            (offset) => setDraft((d) => ({ ...d, stages: move(d.stages, stageIndex, offset) })),
            draft.stages.length > 1 ? () => removeStage(stage.key) : undefined)}
        </div>
        <Field label="Stage title" value={stage.title} onChange={(title) => updateStage(stage.key, (s) => ({ ...s, title }))} isRequired
          maxLength={LIMITS.stageTitle} error={showErrors ? validateText(stage.title, "Stage title", LIMITS.stageTitle) : null} placeholder="Research and framing" />
        <div>
          <p className="m-0 mb-2 text-sm font-medium">Lessons</p>
          <ol className="m-0 flex list-none flex-col divide-y divide-separator rounded-xl border border-border p-0">
            {stage.lessons.map((l, li) => (
              <li key={l.key} className="flex items-center gap-3 px-3 py-2">
                <span className="w-7 text-xs text-muted tabular-nums">{stageIndex + 1}.{li + 1}</span>
                <button type="button" className="min-w-0 flex-1 truncate text-left text-sm hover:text-accent" onClick={() => openTarget(l.key)}>
                  {l.title.trim() || "Untitled lesson"}
                </button>
                <span className="shrink-0 text-xs text-muted">{plural(l.blocks.length, "block")}</span>
                {reorderButtons(`lesson ${li + 1}`, li, stage.lessons.length,
                  (offset) => updateStage(stage.key, (s) => ({ ...s, lessons: move(s.lessons, li, offset) })))}
              </li>
            ))}
          </ol>
          <Button variant="ghost" size="sm" className="mt-2" onPress={() => addLesson(stage.key)}>
            <IconPlus size={16} aria-hidden />
            Add lesson
          </Button>
        </div>
      </Card>
    );
  } else {
    const lessonIndex = stage.lessons.indexOf(lesson);
    const setBlocks = (update: (blocks: Block[]) => Block[]) => updateLesson(stage.key, lesson.key, (l) => ({ ...l, blocks: update(l.blocks) }));
    const addBlock = (type: BlockType) => setBlocks((blocks) => [...blocks, createBlock(type)]);
    panel = (
      <div className="flex flex-col gap-4">
        <Card className="gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <p className="m-0 flex-1 text-sm text-muted">
              {stage.title.trim() || `Stage ${stageIndex + 1}`} · Lesson {stageIndex + 1}.{lessonIndex + 1}
            </p>
            <Button variant="ghost" size="sm" isIconOnly aria-label={`Duplicate lesson ${lessonIndex + 1}`} onPress={() => copyLesson(stage.key, lesson)}>
              <IconCopy size={16} aria-hidden />
            </Button>
            {reorderButtons(`lesson ${lessonIndex + 1}`, lessonIndex, stage.lessons.length,
              (offset) => updateStage(stage.key, (s) => ({ ...s, lessons: move(s.lessons, lessonIndex, offset) })),
              stage.lessons.length > 1 ? () => removeLesson(stage.key, lesson.key) : undefined)}
          </div>
          <Field label="Lesson title" value={lesson.title} onChange={(title) => updateLesson(stage.key, lesson.key, (l) => ({ ...l, title }))} isRequired
            maxLength={LIMITS.lessonTitle} error={showErrors ? validateText(lesson.title, "Lesson title", LIMITS.lessonTitle) : null} placeholder="User interviews in practice" />
          <Tabs selectedKey={isPreview ? "preview" : "edit"} onSelectionChange={(key) => setIsPreview(key === "preview")}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Lesson view">
                <Tabs.Tab id="edit">Edit content<Tabs.Indicator /></Tabs.Tab>
                <Tabs.Tab id="preview">Preview as learner<Tabs.Indicator /></Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </Card>

        {isPreview ? (
          <Card className="p-5 sm:p-8">
            <h2 className="m-0 mb-6 text-2xl font-semibold [overflow-wrap:anywhere]">{lesson.title.trim() || "Untitled lesson"}</h2>
            <LessonContent blocks={lesson.blocks} />
          </Card>
        ) : (
          <>
            {lesson.blocks.length === 0 && (
              <p className="m-0 rounded-xl border border-dashed border-border-tertiary px-6 py-8 text-center text-sm text-muted">
                This lesson is empty. Add text, a video, an image, links, files, callouts or a quiz below.
              </p>
            )}
            {lesson.blocks.map((block, bi) => (
              <BlockEditor
                key={block.id}
                block={block}
                index={bi}
                count={lesson.blocks.length}
                showErrors={showErrors}
                onChange={(next) => setBlocks((blocks) => blocks.map((b) => (b.id === block.id ? next : b)))}
                onMove={(offset) => setBlocks((blocks) => move(blocks, bi, offset))}
                onRemove={() => setBlocks((blocks) => blocks.filter((b) => b.id !== block.id))}
                onDuplicate={() => setBlocks((blocks) => {
                  const copy = { ...structuredClone(block), id: createId() } as Block;
                  if (copy.type === "quiz") {
                    copy.options = copy.options.map((o) => ({ ...o, id: createId() }));
                    copy.pairs = copy.pairs.map((p) => ({ ...p, id: createId() }));
                  }
                  return [...blocks.slice(0, bi + 1), copy, ...blocks.slice(bi + 1)];
                })}
              />
            ))}
            {lesson.blocks.length < LIMITS.blocks && (
              <Card className="gap-3 border border-dashed border-border-tertiary bg-transparent p-4 shadow-none">
                <p className="m-0 text-sm font-medium">Add to this lesson</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {BLOCK_TYPES.map(({ type, label, icon: Icon, hint }) => (
                    <button key={type} type="button" onClick={() => addBlock(type)} aria-label={`Add ${label.toLowerCase()} block`}
                      className="flex flex-col items-start gap-1 rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-accent/50 hover:bg-accent-soft">
                      <Icon size={18} className="text-accent" aria-hidden />
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-xs text-muted">{hint}</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 pb-28">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-separator pb-6">
        <div className="min-w-0">
          <h1 className="m-0 text-[clamp(26px,3.5vw,36px)] font-semibold leading-tight tracking-tight">{course ? "Edit course" : "Create a course"}</h1>
          <p className="m-0 mt-1 text-sm text-muted">{plural(draft.stages.length, "stage")} · {plural(lessonCount, "lesson")}</p>
        </div>
      </section>

      {restored && (
        <Alert status="accent" className="mt-6 items-center">
          <Alert.Content>
            <Alert.Title>Your unsaved draft is back</Alert.Title>
            <Alert.Description>
              Saved {savedTime.format(new Date(restored.savedAt))}, on this or another device. Save to keep it{course ? " in the course" : ""}, or discard it to start over.
              Cover images you picked then need choosing again.
            </Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="ghost" onPress={discardDraft}>Discard draft</Button>
        </Alert>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <nav aria-label="Course outline">{outline}</nav>
        <div ref={panelRef} className="min-w-0 scroll-mt-4">{panel}</div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-separator bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <div className="min-w-0 flex-1">
            {showErrors && problems.length > 0 ? (
              <details className="text-sm text-danger">
                <summary className="cursor-pointer font-medium">
                  <IconAlertCircle size={16} className="mr-1 inline align-[-3px]" aria-hidden />
                  {plural(problems.length, "thing")} to fix before {isPublishing ? "publishing" : "saving"}
                </summary>
                <ul className="m-0 mt-2 max-h-40 list-none overflow-y-auto p-0">
                  {problems.map((p, i) => (
                    <li key={i}>
                      <button type="button" className="py-0.5 text-left underline-offset-2 hover:underline" onClick={() => openTarget(p.target)}>{p.message}</button>
                    </li>
                  ))}
                </ul>
              </details>
            ) : saveError ? (
              <Alert status="danger" className="py-2">
                <Alert.Indicator><IconAlertCircle size={18} /></Alert.Indicator>
                <Alert.Content><Alert.Description>{saveError}</Alert.Description></Alert.Content>
              </Alert>
            ) : (
              <p className="m-0 text-sm text-muted">
                {!isDirty ? (course ? "No changes yet" : "Start with the details, then build each lesson.")
                  : draftStatus === "failed" ? "Couldn't save the draft just now. Your work is still here and is retried as you type."
                  : draftStatus === "saving" || changeCount !== storedCount ? "Saving draft…"
                  : `Draft saved${draftSavedAt ? ` at ${savedTime.format(new Date(draftSavedAt))}` : ""} · not saved to the course yet`}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link className={buttonVariants({ variant: "ghost" })} href={course ? `/courses/${course.id}` : "/teach"}>Cancel</Link>
            <Button onPress={save} isPending={isSaving}>
              {isSaving ? "Saving…"
                : details.status === "draft" ? "Save draft"
                : course?.status === details.status ? "Save changes"
                : details.status === "published" ? "Publish course" : "Save as unlisted"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CourseBuilder;
