import axios from 'axios';
import { authApi } from './auth.api';
import { useUserStore } from '../store/store';

export const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const { user } = useUserStore.getState();     
  const token = user?.access;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let isRefreshing = false;
let failedQueue: {
  resolve: (value?: any) => void;
  reject: (error: any) => void;
}[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    error ? prom.reject(error) : prom.resolve(token);
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (!error.response) return Promise.reject(error);

    const { user, logout } = useUserStore.getState();  
    const refreshToken = user?.refresh;

    if (error.response.status === 401 && refreshToken) {
      if (originalRequest._retry) return Promise.reject(error);

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient.request(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const data = await authApi.refresh({ refresh: refreshToken });

        if (data.access) {
          useUserStore.setState((state) => ({
            user: { ...state.user!, access: data.access },
          }));

          processQueue(null, data.access);

          originalRequest.headers.Authorization = `Bearer ${data.access}`;
          return apiClient.request(originalRequest);
        } else {
          localStorage.clear();
          logout();
          processQueue(error, null);
          return Promise.reject(error);
        }
      } catch (err) {
        localStorage.clear();
        logout();
        processQueue(err, null);
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
