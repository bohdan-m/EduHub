import type {
    Block, BlockType, CourseDetail, CourseDetailsInput, CourseInput, MatchPair, QuizBlock, QuizKind, QuizOption,
} from "./types/courses.js";
import { LIMITS, validateText, validateVideoUrl, validateWebUrl } from "./validation";

// The course builder's working copy. `key` is a client id for React and selection; `id` is the server's,
// sent back on save so stages and lessons keep their rows (and links to them).
export interface DraftLesson { key: string; id?: number; title: string; blocks: Block[] }
export interface DraftStage { key: string; id?: number; title: string; lessons: DraftLesson[] }
export interface CourseDraft { title: string; description: string; stages: DraftStage[]; details: CourseDetailsInput }

// crypto.randomUUID needs a secure context; plain http on a LAN IP doesn't have one
export const createId = () =>
    (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/-/g, "").slice(0, 32);

export const emptyDetails = (): CourseDetailsInput => ({
    status: "draft", category: "other", level: "all", language: "en", outcomes: [], requirements: [], intro_video_url: "",
});
export const emptyLesson = (): DraftLesson => ({ key: createId(), title: "", blocks: [] });
export const emptyStage = (): DraftStage => ({ key: createId(), title: "", lessons: [emptyLesson()] });
export const emptyDraft = (): CourseDraft => ({ title: "", description: "", stages: [emptyStage()], details: emptyDetails() });

const option = (text = "", correct = false): QuizOption => ({ id: createId(), text, correct });
const pair = (): MatchPair => ({ id: createId(), left: "", right: "" });

export const createQuizOption = () => option();
export const createMatchPair = pair;

/** A fresh quiz of a kind; "truefalse" is a choice quiz with the two answers filled in. */
export function createQuiz(kind: QuizKind | "truefalse", id = createId()): QuizBlock {
    const base = { type: "quiz" as const, id, question: "", explanation: "", options: [], answers: [], pairs: [] };
    switch (kind) {
        case "truefalse": return { ...base, kind: "choice", options: [option("True", true), option("False")] };
        case "short": return { ...base, kind: "short", answers: [""] };
        case "match": return { ...base, kind: "match", pairs: [pair(), pair()] };
        default: return { ...base, kind: "choice", options: [option(), option()] };
    }
}

export function createBlock(type: BlockType): Block {
    const id = createId();
    switch (type) {
        case "text": return { type, id, text: "" };
        case "video": return { type, id, url: "", caption: "" };
        case "link": return { type, id, url: "", title: "", description: "" };
        case "callout": return { type, id, tone: "tip", text: "" };
        case "image": return { type, id, path: "", alt: "", caption: "" };
        case "file": return { type, id, path: "", name: "", size: 0, description: "" };
        case "quiz": return createQuiz("choice", id);
    }
}

/** A copy of a lesson with new ids, to be saved as a new lesson. */
export function duplicateLesson(lesson: DraftLesson): DraftLesson {
    return {
        key: createId(),
        title: `${lesson.title} (copy)`.slice(0, LIMITS.lessonTitle),
        blocks: lesson.blocks.map((block) => {
            const copy = { ...block, id: createId() } as Block;
            if (copy.type === "quiz") {
                copy.options = copy.options.map((o) => ({ ...o, id: createId() }));
                copy.pairs = copy.pairs.map((p) => ({ ...p, id: createId() }));
            }
            return copy;
        }),
    };
}

/** Stored quizzes from before quiz kinds lack the new fields. */
export function normalizeBlock(block: Block): Block {
    if (block.type !== "quiz") return block;
    return { ...block, kind: block.kind ?? "choice", options: block.options ?? [], answers: block.answers ?? [], pairs: block.pairs ?? [] };
}

export function draftFromCourse(course: CourseDetail): CourseDraft {
    return {
        title: course.title,
        description: course.description,
        details: {
            status: course.status, category: course.category, level: course.level, language: course.language,
            outcomes: course.outcomes, requirements: course.requirements, intro_video_url: course.intro_video_url,
        },
        stages: course.stages.map((stage) => ({
            key: createId(),
            id: stage.id,
            title: stage.title,
            // only the author edits, and the author gets quizzes with their answers
            lessons: stage.lessons.map((lesson) => ({
                key: createId(), id: lesson.id, title: lesson.title, blocks: (lesson.blocks as Block[]).map(normalizeBlock),
            })),
        })),
    };
}

function cleanBlock(block: Block): Block {
    switch (block.type) {
        case "text": return { ...block, text: block.text.trim() };
        case "video": return { ...block, url: block.url.trim(), caption: block.caption.trim() };
        case "link": return { ...block, url: block.url.trim(), title: block.title.trim(), description: block.description.trim() };
        case "callout": return { ...block, text: block.text.trim() };
        // the URL comes from the API on the way out; only the path is stored
        case "image": return { type: "image", id: block.id, path: block.path, alt: block.alt.trim(), caption: block.caption.trim() };
        case "file": return { type: "file", id: block.id, path: block.path, name: block.name.trim(), size: block.size, description: block.description.trim() };
        case "quiz": return {
            ...block,
            question: block.question.trim(),
            explanation: block.explanation.trim(),
            options: block.kind === "choice" ? block.options.map((o) => ({ ...o, text: o.text.trim() })) : [],
            answers: block.kind === "short" ? block.answers.map((a) => a.trim()).filter(Boolean) : [],
            pairs: block.kind === "match" ? block.pairs.map((p) => ({ ...p, left: p.left.trim(), right: p.right.trim() })) : [],
        };
    }
}

const cleanList = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);

/** The API body: trimmed text, positions numbered from 1, server ids kept. */
export function buildCoursePayload(draft: CourseDraft): CourseInput {
    const details = draft.details ?? emptyDetails();
    return {
        title: draft.title.trim(),
        description: draft.description.trim(),
        ...details,
        outcomes: cleanList(details.outcomes),
        requirements: cleanList(details.requirements),
        intro_video_url: details.intro_video_url.trim(),
        stages: draft.stages.map((stage, stageIndex) => ({
            ...(stage.id ? { id: stage.id } : {}),
            title: stage.title.trim(),
            order: stageIndex + 1,
            lessons: stage.lessons.map((lesson, lessonIndex) => ({
                ...(lesson.id ? { id: lesson.id } : {}),
                title: lesson.title.trim(),
                order: lessonIndex + 1,
                blocks: lesson.blocks.map(cleanBlock),
            })),
        })),
    };
}

const optionalLength = (value: string, label: string, max: number) =>
    value.trim().length > max ? `${label} must be ${max} characters or fewer.` : null;

function validateQuiz(block: QuizBlock): string | null {
    const problem = validateText(block.question, "Question", LIMITS.quizQuestion);
    if (problem) return problem;
    if (block.kind === "short") {
        const answers = block.answers.filter((a) => a.trim());
        if (answers.length === 0) return "Add at least one accepted answer.";
        if (answers.length > LIMITS.quizOptions) return `Add up to ${LIMITS.quizOptions} accepted answers.`;
        if (answers.some((a) => a.trim().length > LIMITS.shortAnswer)) return `Answers must be ${LIMITS.shortAnswer} characters or fewer.`;
    } else if (block.kind === "match") {
        if (block.pairs.length < 2 || block.pairs.length > LIMITS.quizOptions) return `A matching quiz needs 2 to ${LIMITS.quizOptions} pairs.`;
        const blank = block.pairs.findIndex((p) => !p.left.trim() || !p.right.trim());
        if (blank >= 0) return `Pair ${blank + 1} needs both sides.`;
        const rights = block.pairs.map((p) => p.right.trim().toLowerCase());
        if (new Set(rights).size !== rights.length) return "Each pair needs a different right-hand side.";
    } else {
        if (block.options.length < 2 || block.options.length > LIMITS.quizOptions) return `A quiz needs 2 to ${LIMITS.quizOptions} answers.`;
        const blank = block.options.findIndex((o) => !o.text.trim());
        if (blank >= 0) return `Answer ${blank + 1} is empty.`;
        const long = block.options.findIndex((o) => o.text.trim().length > LIMITS.quizOption);
        if (long >= 0) return `Answer ${long + 1} must be ${LIMITS.quizOption} characters or fewer.`;
        if (!block.options.some((o) => o.correct)) return "Mark at least one answer as correct.";
    }
    return optionalLength(block.explanation, "Explanation", LIMITS.quizExplanation);
}

/** First problem with a block, or null. Mirrors the API's rules so a save rarely fails there. */
export function validateBlock(block: Block): string | null {
    switch (block.type) {
        case "text":
            return validateText(block.text, "Text", LIMITS.blockText);
        case "video":
            return block.url.trim() ? validateVideoUrl(block.url) : "Add a YouTube or Vimeo link.";
        case "link":
            return validateWebUrl(block.url) ?? validateText(block.title, "Link title", LIMITS.linkTitle)
                ?? optionalLength(block.description, "Description", LIMITS.linkDescription);
        case "callout":
            return validateText(block.text, "Note", LIMITS.calloutText);
        case "image":
            if (!block.path) return "Upload an image.";
            return validateText(block.alt, "Image description", LIMITS.imageAlt);
        case "file":
            if (!block.path) return "Upload a file.";
            return validateText(block.name, "File name", LIMITS.linkTitle) ?? optionalLength(block.description, "Description", LIMITS.fileDescription);
        case "quiz":
            return validateQuiz(block);
    }
}

export interface DraftProblem {
    /** "details", or the key of the stage or lesson to open */
    target: string
    message: string
}

function validateList(items: string[], label: string): string | null {
    const filled = cleanList(items);
    if (filled.length > LIMITS.listItems) return `${label}: add up to ${LIMITS.listItems} items.`;
    if (filled.some((item) => item.length > LIMITS.listItem)) return `${label}: keep each item under ${LIMITS.listItem} characters.`;
    return null;
}

/** Everything that would stop a save, in outline order, so the builder can list them and jump to each.
 *  With `publishing`, also every empty lesson: a live course needs content in each one. */
export function findProblems(draft: CourseDraft, { publishing = false } = {}): DraftProblem[] {
    const problems: DraftProblem[] = [];
    const add = (target: string, message: string | null) => message && problems.push({ target, message });
    const details = draft.details ?? emptyDetails();

    add("details", validateText(draft.title, "Course title", LIMITS.courseTitle));
    add("details", validateText(draft.description, "Description", LIMITS.courseDescription));
    add("details", validateList(details.outcomes, "What learners will learn"));
    add("details", validateList(details.requirements, "Requirements"));
    add("details", prefixed("Intro video", validateVideoUrl(details.intro_video_url)));
    if (draft.stages.length === 0) add("details", "Add at least one stage.");

    draft.stages.forEach((stage, s) => {
        const stageName = `Stage ${s + 1}`;
        add(stage.key, prefixed(stageName, validateText(stage.title, "Stage title", LIMITS.stageTitle)));
        if (stage.lessons.length === 0) add(stage.key, `${stageName}: add at least one lesson.`);
        stage.lessons.forEach((lesson, l) => {
            const lessonName = `Lesson ${s + 1}.${l + 1}`;
            add(lesson.key, prefixed(lessonName, validateText(lesson.title, "Lesson title", LIMITS.lessonTitle)));
            if (lesson.blocks.length > LIMITS.blocks) add(lesson.key, `${lessonName}: use up to ${LIMITS.blocks} blocks.`);
            if (publishing && lesson.blocks.length === 0) add(lesson.key, `${lessonName}: add some content before publishing.`);
            lesson.blocks.forEach((block, b) => add(lesson.key, prefixed(`${lessonName}, block ${b + 1}`, validateBlock(block))));
        });
    });
    return problems;
}

const prefixed = (where: string, message: string | null) => (message ? `${where}: ${message}` : null);
