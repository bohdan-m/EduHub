export interface User {
    username: string;
    email: string;
    role: 'student' | 'teacher';
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface RefreshRequest {
    refresh: string;
}

export interface LoginResponse {
    user: User; 
    access: string;
    refresh: string;
}

export interface RegisterRequest {
    username: string;
    password: string;
    role: "student" | "teacher";
    email: string;
}
