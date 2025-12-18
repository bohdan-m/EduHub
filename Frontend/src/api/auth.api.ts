import type { CourseListItem, CourseListResponse } from '../utils/types/courses';
import type { LoginRequest, LoginResponse, RefreshRequest, RegisterRequest, User } from '../utils/types/user';
import { apiClient } from './axios.config';

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/login/', credentials);
    return data;
  },

  refresh: async (credentials: RefreshRequest): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/refresh/', credentials);
    return data;
  },

  register: async (credentials: RegisterRequest): Promise<User> => {
    const { data } = await apiClient.post<User>('/register/', credentials);
    return data;
  },
};

export const coursesApi = {
  courses: async (): Promise<CourseListItem[]> => {
    const { data } = await apiClient.get<CourseListResponse>('/courses/');
    return data.results;
  },
};