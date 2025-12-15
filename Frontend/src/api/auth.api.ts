import type { User } from '../utils/types/user';
import { apiClient } from './axios.config';

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