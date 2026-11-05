import type { CourseCategory, CourseLanguage, CourseLevel, CourseStatus } from "./types/courses";

// Keep in step with Backend/app/schemas.py
export const CATEGORIES: Record<CourseCategory, string> = {
    programming: "Programming",
    data: "Data & analytics",
    design: "Design",
    business: "Business",
    marketing: "Marketing",
    languages: "Languages",
    science: "Science & maths",
    personal: "Personal growth",
    other: "Other",
};

export const LEVELS: Record<CourseLevel, string> = {
    all: "All levels",
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
};

export const LANGUAGES: Record<CourseLanguage, string> = {
    en: "English",
    uk: "Ukrainian",
    de: "German",
    fr: "French",
    es: "Spanish",
    pl: "Polish",
    other: "Other",
};

export const STATUSES: Record<CourseStatus, { label: string; hint: string }> = {
    draft: { label: "Draft", hint: "Only you can see it." },
    unlisted: { label: "Unlisted", hint: "Anyone with the link can open it; it isn't in the catalogue." },
    published: { label: "Published", hint: "In the catalogue for everyone." },
};

/** "45 min", "2 h", "3 h 20 min" */
export function formatMinutes(minutes: number): string {
    if (minutes < 60) return `${Math.max(1, minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
