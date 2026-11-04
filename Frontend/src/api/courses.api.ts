import type { CourseDetail, CourseInput, CourseListItem, CourseListResponse, QuizResult } from '../utils/types/courses';
import { apiClient } from './axios.config';

// The client defaults to JSON, and axios then turns a FormData body into JSON too (so `stages` would
// arrive as a string): multipart requests must say so, and the browser adds the boundary
const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };
const configFor = (body: unknown) => (body instanceof FormData ? multipart : undefined);

// JSON when there are no new images, multipart (stages as a JSON string) when there are
function courseBody(payload: CourseInput, images: File[], keptImageIds?: number[]) {
  if (images.length === 0) {
    return keptImageIds ? { ...payload, kept_images: keptImageIds } : payload;
  }
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('description', payload.description);
  formData.append('stages', JSON.stringify(payload.stages));
  if (keptImageIds) formData.append('kept_images', JSON.stringify(keptImageIds));
  for (const image of images) formData.append('uploaded_images', image);
  return formData;
}

export const coursesApi = {
  courses: async (url: string): Promise<CourseListResponse> => {
    const { data } = await apiClient.get<CourseListResponse>(url);
    return data;
  },

  courseDetail: async (courseId: string): Promise<CourseDetail> => {
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

  deleteCourse: async (courseId: number): Promise<void> => {
    await apiClient.delete(`/courses/${courseId}/delete/`);
  },

  /** The server grades: learners never get the correct answers before trying. */
  checkQuiz: async (courseId: number, lessonId: number, blockId: string, selected: string[]): Promise<QuizResult> => {
    const { data } = await apiClient.post<QuizResult>(`/courses/${courseId}/lessons/${lessonId}/quizzes/${blockId}/check/`, { selected });
    return data;
  },
};
