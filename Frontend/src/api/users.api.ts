import type { CourseListItem, Rating } from '../utils/types/courses';
import { apiClient } from './axios.config';

export interface Me { id: number; name: string; email: string; headline: string; bio: string; is_admin: boolean }
export interface AuthorProfile {
  id: number
  name: string
  headline: string
  bio: string
  joined: string
  course_count: number
  learner_count: number
  rating: Rating
  courses: CourseListItem[]
}
export interface Uploaded { path: string; url: string; name: string; size: number; kind: 'image' | 'file' }

export const usersApi = {
  me: async (): Promise<Me> => {
    const { data } = await apiClient.get<Me>('/me/');
    return data;
  },

  updateProfile: async (headline: string, bio: string): Promise<Me> => {
    const { data } = await apiClient.patch<Me>('/me/', { headline, bio });
    return data;
  },

  exportData: async (): Promise<unknown> => {
    const { data } = await apiClient.get('/me/export/');
    return data;
  },

  author: async (userId: number | string): Promise<AuthorProfile> => {
    const { data } = await apiClient.get<AuthorProfile>(`/users/${userId}/`);
    return data;
  },

  /** An image (re-encoded by the API) or an attachment for a lesson block. Uploads can be big, so no 10 s cap. */
  upload: async (file: File, kind: 'image' | 'file'): Promise<Uploaded> => {
    const body = new FormData();
    body.append('file', file);
    const { data } = await apiClient.post<Uploaded>('/uploads/', body, {
      params: { kind }, headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000,
    });
    return data;
  },
};
