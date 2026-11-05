export interface AuthorItem {
    id: number
    name: string
    headline?: string
}

export interface AuthorDetail extends AuthorItem {
    bio?: string
}

export interface CourseImage {
    id: number
    image: string
    thumbnail: string
}

export interface StageShort {
    id: number
    title: string
    order: number
}

export type CourseStatus = "draft" | "published" | "unlisted"
export type CourseLevel = "all" | "beginner" | "intermediate" | "advanced"
export type CourseCategory = "programming" | "data" | "design" | "business" | "marketing" | "languages" | "science" | "personal" | "other"
export type CourseLanguage = "en" | "uk" | "de" | "fr" | "es" | "pl" | "other"

// Lesson content blocks; the API validates the same shapes (Backend/app/schemas.py)
export interface TextBlock { type: "text"; id: string; text: string }
export interface VideoBlock { type: "video"; id: string; url: string; caption: string }
export interface LinkBlock { type: "link"; id: string; url: string; title: string; description: string }
export type CalloutTone = "info" | "tip" | "warning"
export interface CalloutBlock { type: "callout"; id: string; tone: CalloutTone; text: string }
/** Uploaded through /api/uploads/; `url` comes back from the API and isn't sent. */
export interface ImageBlock { type: "image"; id: string; path: string; alt: string; caption: string; url?: string }
export interface FileBlock { type: "file"; id: string; path: string; name: string; size: number; description: string; url?: string }
export interface QuizOption { id: string; text: string; correct: boolean }
export interface MatchPair { id: string; left: string; right: string }
export type QuizKind = "choice" | "short" | "match"
export interface QuizBlock {
    type: "quiz"; id: string; kind: QuizKind; question: string; explanation: string
    options: QuizOption[]; answers: string[]; pairs: MatchPair[]
}
export type Block = TextBlock | VideoBlock | LinkBlock | CalloutBlock | ImageBlock | FileBlock | QuizBlock
export type BlockType = Block["type"]

/** A quiz as learners receive it: no answers or explanation until the API grades an attempt. */
export interface PublicQuizBlock {
    type: "quiz"; id: string; kind: QuizKind; question: string
    options?: { id: string; text: string }[]; multiple?: boolean
    lefts?: { id: string; text: string }[]; rights?: string[]
}
/** Authors get their blocks in full; everyone else gets quizzes as PublicQuizBlock. */
export type LessonBlock = Block | PublicQuizBlock

export interface QuizAnswer { selected: string[]; text: string; matches: Record<string, string> }
export interface QuizResult {
    correct: boolean; correct_option_ids: string[]; accepted_answers: string[]
    correct_matches: Record<string, string>; explanation: string
}

export interface LessonItem {
    id: number
    title: string
    order: number
    blocks: LessonBlock[]
}

export interface StageDetail {
    id: number
    title: string
    order: number
    lessons: LessonItem[]
}

export interface Rating { average: number | null; count: number }

export interface CourseListItem {
    id: number
    title: string
    description: string
    created_at: string
    updated_at: string
    published_at: string | null
    status: CourseStatus
    category: CourseCategory
    level: CourseLevel
    language: CourseLanguage
    lesson_count: number
    estimated_minutes: number
    author: AuthorItem | null
    images: CourseImage[]
    rating: Rating
    learner_count: number
    stages: StageShort[]
}

export interface CourseListResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: CourseListItem[];
}

export interface Enrollment {
    enrolled_at: string
    last_lesson_id: number | null
    completed_at: string | null
    certificate_code: string | null
    completed_lesson_ids: number[]
    bookmarked_lesson_ids: number[]
    quiz_results: Record<string, boolean>
}

export interface CourseDetail extends Omit<CourseListItem, "stages" | "author"> {
    author: AuthorDetail | null
    stages: StageDetail[]
    outcomes: string[]
    requirements: string[]
    intro_video_url: string
    is_owner: boolean
    is_hidden: boolean
    enrollment: Enrollment | null
    my_review_id: number | null
}

export interface CourseLessonInput {
    id?: number
    title: string
    order: number
    blocks: Block[]
}

export interface CourseStageInput {
    id?: number
    title: string
    order: number
    lessons: CourseLessonInput[]
}

export interface CourseDetailsInput {
    status: CourseStatus
    category: CourseCategory
    level: CourseLevel
    language: CourseLanguage
    outcomes: string[]
    requirements: string[]
    intro_video_url: string
}

export interface CourseInput extends CourseDetailsInput {
    title: string
    description: string
    stages: CourseStageInput[]
}

export interface CourseQuery {
    q?: string
    category?: CourseCategory | ""
    level?: CourseLevel | ""
    sort?: "newest" | "popular" | "rating"
    author?: number
}
