import type { CourseListItem, Enrollment } from '../utils/types/courses';
import { apiClient } from './axios.config';

export interface LessonProgress { completed: boolean; bookmarked: boolean; note: string }
export interface LearningItem {
  course: CourseListItem
  completed_lessons: number
  total_lessons: number
  last_lesson_id: number | null
  last_seen_at: string
  completed_at: string | null
  certificate_code: string | null
}
export interface Bookmark { course_id: number; course_title: string; lesson_id: number; lesson_title: string; note: string }
export interface Certificate {
  code: string
  learner_name: string
  course_id: number
  course_title: string
  author_name: string
  lesson_count: number
  completed_at: string
}
export interface TeachingItem { course: CourseListItem; completed: number; unanswered_reviews: number }

export const learningApi = {
  enroll: async (courseId: number): Promise<Enrollment> => {
    const { data } = await apiClient.post<Enrollment>(`/courses/${courseId}/enroll/`);
    return data;
  },

  leave: async (courseId: number): Promise<void> => {
    await apiClient.delete(`/courses/${courseId}/enroll/`);
  },

  lessonProgress: async (courseId: number, lessonId: number): Promise<LessonProgress> => {
    const { data } = await apiClient.get<LessonProgress>(`/courses/${courseId}/lessons/${lessonId}/progress/`);
    return data;
  },

  /** Fields left out stay as they are; any update also remembers this lesson as where the learner is. */
  updateProgress: async (courseId: number, lessonId: number, changes: Partial<LessonProgress>) => {
    const { data } = await apiClient.put<{ lesson: LessonProgress; enrollment: Enrollment }>(
      `/courses/${courseId}/lessons/${lessonId}/progress/`, changes);
    return data;
  },

  myLearning: async (): Promise<{ courses: LearningItem[]; bookmarks: Bookmark[] }> => {
    const { data } = await apiClient.get('/me/learning/');
    return data;
  },

  myTeaching: async (): Promise<TeachingItem[]> => {
    const { data } = await apiClient.get<TeachingItem[]>('/me/teaching/');
    return data;
  },
};
