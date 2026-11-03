export interface AuthorItem {
    id: number
    name: string
    role: string
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

export interface LessonItem {
    id: number
    title: string
    url: string
    order: number
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
}

export interface CourseCreateLessonInput {
    title: string
    url: string
    order: number
}

export interface CourseCreateStageInput {
    title: string
    order: number
    lessons: CourseCreateLessonInput[]
}

export interface CourseCreateInput {
    title: string
    description: string
    stages: CourseCreateStageInput[]
    uploaded_images?: File[]
}
