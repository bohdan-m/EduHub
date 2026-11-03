import type { CourseCreateInput, CourseDetail, CourseListItem, CourseListResponse } from '../utils/types/courses';
import { apiClient } from './axios.config';

export const coursesApi = {
  courses: async (url: string): Promise<CourseListResponse> => {
    const { data } = await apiClient.get<CourseListResponse>(url);
    return data;
  },

  courseDetail: async (courseId: string): Promise<CourseDetail> => {
    const { data } = await apiClient.get<CourseDetail>(`/courses/${courseId}/`);
    return data;
  },

  createCourse: async (payload: CourseCreateInput): Promise<CourseListItem> => {
    const hasImages = Boolean(payload.uploaded_images && payload.uploaded_images.length > 0);

    if (!hasImages) {
      const { data } = await apiClient.post<CourseListItem>('/courses/create/', {
        title: payload.title,
        description: payload.description,
        stages: payload.stages,
        uploaded_images: [],
      });

      return data;
    }

    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('description', payload.description);
    formData.append('stages', JSON.stringify(payload.stages));

    for (const image of payload.uploaded_images ?? []) {
      formData.append('uploaded_images', image);
    }

    const { data } = await apiClient.post<CourseListItem>('/courses/create/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return data;
  },
};
