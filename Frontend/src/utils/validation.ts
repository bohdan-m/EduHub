import { getVideoEmbedUrl } from "./youtube";

// Field rules shared by the forms and the Better Auth server hooks. Each returns an error message, or null when valid.
// Course limits must stay in step with Backend/app/schemas.py.
export const LIMITS = {
    name: 100,
    passwordMin: 8,
    passwordMax: 128,
    courseTitle: 100,
    courseDescription: 5000,
    stageTitle: 100,
    lessonTitle: 100,
    images: 5,
    imageBytes: 5 * 1024 * 1024,
    blocks: 50,
    blockText: 20000,
    linkUrl: 2000,
    linkTitle: 200,
    linkDescription: 500,
    calloutText: 2000,
    quizQuestion: 500,
    quizOption: 200,
    quizOptions: 8,
    quizExplanation: 1000,
    videoCaption: 200,
    listItems: 10,
    listItem: 160,
    imageAlt: 200,
    fileBytes: 20 * 1024 * 1024,
    fileDescription: 300,
    shortAnswer: 200,
    review: 2000,
    comment: 2000,
    note: 5000,
    headline: 100,
    bio: 1000,
} as const;

// Deliberately loose (something@something.tld); the server is the final judge of an address
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(value: string): string | null {
    const name = value.trim();
    if (!name) return "Enter your name.";
    if (name.length > LIMITS.name) return `Keep your name under ${LIMITS.name} characters.`;
    return null;
}

export function validateEmail(value: string): string | null {
    const email = value.trim();
    if (!email) return "Enter your email address.";
    if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address, like name@example.com.";
    return null;
}

export function validatePassword(value: string, { isNew }: { isNew: boolean }): string | null {
    if (!value) return "Enter your password.";
    if (isNew && value.length < LIMITS.passwordMin) return `Use at least ${LIMITS.passwordMin} characters.`;
    if (value.length > LIMITS.passwordMax) return `Use ${LIMITS.passwordMax} characters or fewer.`;
    return null;
}

/** Required text with a length cap: "Course title", "Stage title"... */
export function validateText(value: string, label: string, max: number): string | null {
    const text = value.trim();
    if (!text) return `Enter a ${label.toLowerCase()}.`;
    if (text.length > max) return `${label} must be ${max} characters or fewer.`;
    return null;
}

/** Optional, but when given it must be a YouTube or Vimeo link the lesson player can embed. */
export function validateVideoUrl(value: string): string | null {
    const url = value.trim();
    if (!url) return null;
    if (!getVideoEmbedUrl(url)) return "Use a YouTube or Vimeo video link, like https://www.youtube.com/watch?v=…";
    return null;
}

/** Required, and only http(s): a javascript: link would run in the learner's browser. */
export function validateWebUrl(value: string): string | null {
    const url = value.trim();
    if (!url) return "Add a link.";
    try {
        const parsed = new URL(url);
        if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname && url.length <= LIMITS.linkUrl) return null;
    } catch {
        // falls through to the message below
    }
    return "Use a full web address starting with https://.";
}

export function validateImages(files: { name: string; size: number; type: string }[]): string | null {
    if (files.length > LIMITS.images) return `Choose up to ${LIMITS.images} images.`;
    const notImage = files.find((file) => !file.type.startsWith("image/"));
    if (notImage) return `"${notImage.name}" isn't an image.`;
    const tooBig = files.find((file) => file.size > LIMITS.imageBytes);
    if (tooBig) return `"${tooBig.name}" is over 5 MB.`;
    return null;
}

export function validateTotpCode(value: string): string | null {
    const code = value.trim();
    if (!code) return "Enter the code from your authenticator app.";
    if (!/^\d{6}$/.test(code)) return "The code is 6 digits.";
    return null;
}

export function validateBackupCode(value: string): string | null {
    if (!value.trim()) return "Enter one of your backup codes.";
    return null;
}
