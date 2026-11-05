import type {
  CourseDetail, CourseInput, CourseListItem, CourseListResponse, CourseQuery, CourseStatus, QuizAnswer, QuizResult, Rating,
} from '../utils/types/courses';
import { apiClient } from './axios.config';

// The client defaults to JSON, and axios then turns a FormData body into JSON too (so `stages` would
// arrive as a string): multipart requests must say so, and the browser adds the boundary
const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };
const configFor = (body: unknown) => (body instanceof FormData ? multipart : undefined);

// JSON when there are no new images, multipart (list fields as JSON strings) when there are
function courseBody(payload: CourseInput, images: File[], keptImageIds?: number[]) {
  if (images.length === 0) {
    return keptImageIds ? { ...payload, kept_images: keptImageIds } : payload;
  }
  const formData = new FormData();
  for (const [name, value] of Object.entries(payload)) {
    formData.append(name, typeof value === 'string' ? value : JSON.stringify(value));
  }
  if (keptImageIds) formData.append('kept_images', JSON.stringify(keptImageIds));
  for (const image of images) formData.append('uploaded_images', image);
  return formData;
}

/** "/courses/?q=sql&category=data" from the catalogue's filters; empty ones are left out. */
export function catalogueUrl(query: CourseQuery = {}, limit = 12) {
  const params = new URLSearchParams({ limit: String(limit) });
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined && value !== '' && !(name === 'sort' && value === 'newest')) params.set(name, String(value));
  }
  return `/courses/?${params}`;
}

export interface LessonStat { id: number; title: string; completed: number }
export interface QuizStat { lesson_id: number; lesson_title: string; block_id: string; question: string; learners: number; first_try_correct: number }
export interface CourseStats {
  learners: number
  completed: number
  average_progress: number
  rating: Rating
  rating_distribution: Record<string, number>
  lessons: LessonStat[]
  quizzes: QuizStat[]
}

export const coursesApi = {
  courses: async (url: string): Promise<CourseListResponse> => {
    const { data } = await apiClient.get<CourseListResponse>(url);
    return data;
  },

  courseDetail: async (courseId: string | number): Promise<CourseDetail> => {
    const { data } = await apiClient.get<CourseDetail>(`/courses/${courseId}/`);
    return data;
  },

  createCourse: async (payload: CourseInput, images: File[] = []): Promise<CourseListItem> => {
    const body = courseBody(payload, images);
    const { data } = await apiClient.post<CourseListItem>('/courses/create/', body, configFor(body));
    return data;
  },

  /** Replaces the course; images not in keptImageIds are removed. */
  updateCourse: async (courseId: number, payload: CourseInput, keptImageIds: number[], images: File[] = []): Promise<CourseDetail> => {
    const body = courseBody(payload, images, keptImageIds);
    const { data } = await apiClient.put<CourseDetail>(`/courses/${courseId}/`, body, configFor(body));
    return data;
  },

  setStatus: async (courseId: number, status: CourseStatus): Promise<CourseDetail> => {
    const { data } = await apiClient.post<CourseDetail>(`/courses/${courseId}/status/`, { status });
    return data;
  },

  duplicate: async (courseId: number): Promise<CourseListItem> => {
    const { data } = await apiClient.post<CourseListItem>(`/courses/${courseId}/duplicate/`);
    return data;
  },

  related: async (courseId: number): Promise<CourseListItem[]> => {
    const { data } = await apiClient.get<CourseListItem[]>(`/courses/${courseId}/related/`);
    return data;
  },

  stats: async (courseId: number | string): Promise<CourseStats> => {
    const { data } = await apiClient.get<CourseStats>(`/courses/${courseId}/stats/`);
    return data;
  },

  deleteCourse: async (courseId: number): Promise<void> => {
    await apiClient.delete(`/courses/${courseId}/delete/`);
  },

  /** The server grades: learners never get the correct answers before trying. */
  checkQuiz: async (courseId: number, lessonId: number, blockId: string, answer: QuizAnswer): Promise<QuizResult> => {
    const { data } = await apiClient.post<QuizResult>(`/courses/${courseId}/lessons/${lessonId}/quizzes/${blockId}/check/`, answer);
    return data;
  },
};
