export interface CourseImage {
    id: number
    image: string 
}

export interface StageShort {
    id: number
    title: string
    order: number
}

export interface CourseListItem {
    id: number
    title: string
    description: string
    author: string
    images: CourseImage[]
    stages: StageShort[]
}

export interface CourseListResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: CourseListItem[];
}