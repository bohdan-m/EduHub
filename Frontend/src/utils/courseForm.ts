import type { Block, BlockType, CourseDetail, CourseInput, QuizOption } from "./types/courses.js";
import { LIMITS, validateText, validateWebUrl, validateYoutubeUrl } from "./validation";

// The course builder's working copy. `key` is a client id for React and selection; `id` is the server's,
// sent back on save so stages and lessons keep their rows (and links to them).
export interface DraftLesson { key: string; id?: number; title: string; blocks: Block[] }
export interface DraftStage { key: string; id?: number; title: string; lessons: DraftLesson[] }
export interface CourseDraft { title: string; description: string; stages: DraftStage[] }

// crypto.randomUUID needs a secure context; plain http on a LAN IP doesn't have one
export const createId = () =>
    (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/-/g, "").slice(0, 32);

export const emptyLesson = (): DraftLesson => ({ key: createId(), title: "", blocks: [] });
export const emptyStage = (): DraftStage => ({ key: createId(), title: "", lessons: [emptyLesson()] });
export const emptyDraft = (): CourseDraft => ({ title: "", description: "", stages: [emptyStage()] });

const option = (): QuizOption => ({ id: createId(), text: "", correct: false });

export function createBlock(type: BlockType): Block {
    const id = createId();
    switch (type) {
        case "text": return { type, id, text: "" };
        case "video": return { type, id, url: "", caption: "" };
        case "link": return { type, id, url: "", title: "", description: "" };
        case "callout": return { type, id, tone: "tip", text: "" };
        case "quiz": return { type, id, question: "", options: [option(), option()], explanation: "" };
    }
}

export const createQuizOption = option;

export function draftFromCourse(course: CourseDetail): CourseDraft {
    return {
        title: course.title,
        description: course.description,
        stages: course.stages.map((stage) => ({
            key: createId(),
            id: stage.id,
            title: stage.title,
            // only the author edits, and the author gets quizzes with their answers
            lessons: stage.lessons.map((lesson) => ({ key: createId(), id: lesson.id, title: lesson.title, blocks: lesson.blocks as Block[] })),
        })),
    };
}

function cleanBlock(block: Block): Block {
    switch (block.type) {
        case "text": return { ...block, text: block.text.trim() };
        case "video": return { ...block, url: block.url.trim(), caption: block.caption.trim() };
        case "link": return { ...block, url: block.url.trim(), title: block.title.trim(), description: block.description.trim() };
        case "callout": return { ...block, text: block.text.trim() };
        case "quiz": return {
            ...block,
            question: block.question.trim(),
            explanation: block.explanation.trim(),
            options: block.options.map((o) => ({ ...o, text: o.text.trim() })),
        };
    }
}

/** The API body: trimmed text, positions numbered from 1, server ids kept. */
export function buildCoursePayload(draft: CourseDraft): CourseInput {
    return {
        title: draft.title.trim(),
        description: draft.description.trim(),
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

/** First problem with a block, or null. Mirrors the API's rules so a save rarely fails there. */
export function validateBlock(block: Block): string | null {
    switch (block.type) {
        case "text":
            return validateText(block.text, "Text", LIMITS.blockText);
        case "video":
            return block.url.trim() ? validateYoutubeUrl(block.url) : "Add a YouTube link.";
        case "link":
            return validateWebUrl(block.url) ?? validateText(block.title, "Link title", LIMITS.linkTitle)
                ?? optionalLength(block.description, "Description", LIMITS.linkDescription);
        case "callout":
            return validateText(block.text, "Note", LIMITS.calloutText);
        case "quiz": {
            const problem = validateText(block.question, "Question", LIMITS.quizQuestion);
            if (problem) return problem;
            if (block.options.length < 2 || block.options.length > LIMITS.quizOptions) return `A quiz needs 2 to ${LIMITS.quizOptions} answers.`;
            const blank = block.options.findIndex((o) => !o.text.trim());
            if (blank >= 0) return `Answer ${blank + 1} is empty.`;
            const long = block.options.findIndex((o) => o.text.trim().length > LIMITS.quizOption);
            if (long >= 0) return `Answer ${long + 1} must be ${LIMITS.quizOption} characters or fewer.`;
            if (!block.options.some((o) => o.correct)) return "Mark at least one answer as correct.";
            return optionalLength(block.explanation, "Explanation", LIMITS.quizExplanation);
        }
    }
}

export interface DraftProblem {
    /** "details", or the key of the stage or lesson to open */
    target: string
    message: string
}

/** Everything that would stop a save, in outline order, so the builder can list them and jump to each. */
export function findProblems(draft: CourseDraft): DraftProblem[] {
    const problems: DraftProblem[] = [];
    const add = (target: string, message: string | null) => message && problems.push({ target, message });

    add("details", validateText(draft.title, "Course title", LIMITS.courseTitle));
    add("details", validateText(draft.description, "Description", LIMITS.courseDescription));
    if (draft.stages.length === 0) add("details", "Add at least one stage.");

    draft.stages.forEach((stage, s) => {
        const stageName = `Stage ${s + 1}`;
        add(stage.key, prefixed(stageName, validateText(stage.title, "Stage title", LIMITS.stageTitle)));
        if (stage.lessons.length === 0) add(stage.key, `${stageName}: add at least one lesson.`);
        stage.lessons.forEach((lesson, l) => {
            const lessonName = `Lesson ${s + 1}.${l + 1}`;
            add(lesson.key, prefixed(lessonName, validateText(lesson.title, "Lesson title", LIMITS.lessonTitle)));
            if (lesson.blocks.length > LIMITS.blocks) add(lesson.key, `${lessonName}: use up to ${LIMITS.blocks} blocks.`);
            lesson.blocks.forEach((block, b) => add(lesson.key, prefixed(`${lessonName}, block ${b + 1}`, validateBlock(block))));
        });
    });
    return problems;
}

const prefixed = (where: string, message: string | null) => (message ? `${where}: ${message}` : null);
