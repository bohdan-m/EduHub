import type { User } from '../utils/types/user';
import { apiClient } from './axios.config';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User; 
  access: string;
  refresh: string;
}

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/login/', credentials);
    return data;
  },
};