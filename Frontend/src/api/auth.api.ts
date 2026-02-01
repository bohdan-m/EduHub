import type { CourseListResponse } from '../utils/types/courses';
import type { LoginRequest, RefreshRequest, RegisterRequest, User } from '../utils/types/user';
import { apiClient } from './axios.config';

export const authApi = {
  login: async (credentials: LoginRequest): Promise<User> => {
    const { data } = await apiClient.post<User>('/login/', credentials);
    return data;
  },

  refresh: async (credentials: RefreshRequest): Promise<User> => {
    const { data } = await apiClient.post<User>('/token/refresh/', credentials);
    return data;
  },

  logout: async (refresh: string): Promise<void> => {
    await apiClient.post('/token/logout/', { refresh });
  },

  register: async (credentials: RegisterRequest): Promise<User> => {
    const { data } = await apiClient.post<User>('/register/', credentials);
    return data;
  },
};

export const coursesApi = {
  courses: async (url: string): Promise<CourseListResponse> => {
    const { data } = await apiClient.get<CourseListResponse>(url);
    return data;
  },
};