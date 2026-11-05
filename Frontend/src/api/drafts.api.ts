import axios from 'axios';
import type { CourseDraft } from '../utils/courseForm';
import { apiClient } from './axios.config';

export interface ServerDraft {
  course_id: number | null
  data: unknown // the builder's own JSON; check it with parseDraftData before use
  updated_at: string
}

// One draft per author and course; no course id means the course being created
const params = (courseId?: number) => (courseId ? { course_id: courseId } : undefined);

export const draftsApi = {
  /** The saved draft, or null when there is none. */
  get: async (courseId?: number): Promise<ServerDraft | null> => {
    try {
      const { data } = await apiClient.get<ServerDraft>('/drafts/', { params: params(courseId) });
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  },

  save: async (draft: CourseDraft, courseId?: number): Promise<ServerDraft> => {
    const { data } = await apiClient.put<ServerDraft>('/drafts/', { course_id: courseId ?? null, data: draft });
    return data;
  },

  remove: async (courseId?: number): Promise<void> => {
    await apiClient.delete('/drafts/', { params: params(courseId) });
  },
};
