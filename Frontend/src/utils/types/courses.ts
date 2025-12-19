export interface AuthorItem {
    id: number
    username: string
    email: string
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

export interface CourseListItem {
    id: number
    title: string
    description: string
    author: AuthorItem
    images: CourseImage[]
    stages: StageShort[]
}

export interface CourseListResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: CourseListItem[];
}