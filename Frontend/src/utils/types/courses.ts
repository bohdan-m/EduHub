export interface AuthorItem {
    id: number
    name: string
};

export interface CourseImage {
    id: number
    image: string 
}

export interface StageShort {
    id: number
    title: string
    order: number
}

// Lesson content blocks; the API validates the same shapes (Backend/app/schemas.py)
export interface TextBlock { type: "text"; id: string; text: string }
export interface VideoBlock { type: "video"; id: string; url: string; caption: string }
export interface LinkBlock { type: "link"; id: string; url: string; title: string; description: string }
export type CalloutTone = "info" | "tip" | "warning"
export interface CalloutBlock { type: "callout"; id: string; tone: CalloutTone; text: string }
export interface QuizOption { id: string; text: string; correct: boolean }
export interface QuizBlock { type: "quiz"; id: string; question: string; options: QuizOption[]; explanation: string }
export type Block = TextBlock | VideoBlock | LinkBlock | CalloutBlock | QuizBlock
export type BlockType = Block["type"]

/** A quiz as learners receive it: no answers or explanation until the API grades an attempt. */
export interface PublicQuizBlock { type: "quiz"; id: string; question: string; options: { id: string; text: string }[]; multiple: boolean }
/** Authors get their blocks in full; everyone else gets quizzes as PublicQuizBlock. */
export type LessonBlock = Block | PublicQuizBlock

export interface QuizResult { correct: boolean; correct_option_ids: string[]; explanation: string }

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

export interface CourseListItem {
    id: number
    title: string
    description: string
    created_at: string
    author: AuthorItem | null
    images: CourseImage[]
    stages: StageShort[]
}

export interface CourseListResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: CourseListItem[];
}

export interface CourseDetail {
    id: number
    title: string
    description: string
    created_at: string
    author: AuthorItem | null
    images: CourseImage[]
    stages: StageDetail[]
    is_owner: boolean
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

export interface CourseInput {
    title: string
    description: string
    stages: CourseStageInput[]
}
