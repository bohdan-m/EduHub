import { emptyDetails, normalizeBlock, type CourseDraft } from "./courseForm";

/** A stored draft, or null when the data isn't one the builder wrote (it comes back from the API as plain JSON).
 *  Drafts saved before course details existed get the defaults. */
export function parseDraftData(data: unknown): CourseDraft | null {
    const draft = data as Partial<CourseDraft> | null;
    const isDraft = typeof draft?.title === "string" && typeof draft?.description === "string" && Array.isArray(draft?.stages)
        && draft.stages.every((s) => typeof s?.key === "string" && typeof s?.title === "string" && Array.isArray(s?.lessons)
            && s.lessons.every((l) => typeof l?.key === "string" && typeof l?.title === "string" && Array.isArray(l?.blocks)));
    if (!isDraft) return null;
    const full = draft as CourseDraft;
    return {
        ...full,
        details: { ...emptyDetails(), ...(full.details ?? {}) },
        stages: full.stages.map((s) => ({ ...s, lessons: s.lessons.map((l) => ({ ...l, blocks: l.blocks.map(normalizeBlock) })) })),
    };
}
