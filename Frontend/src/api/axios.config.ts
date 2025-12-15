import axios from 'axios';
import { authApi } from './auth.api';

export const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
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
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (!error.response) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem('refresh');

    if (error.response.status === 401 && refreshToken) {
      if (originalRequest._retry) {
        return Promise.reject(error);
      }

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
          localStorage.setItem('access', data.access);

          processQueue(null, data.access);

          originalRequest.headers.Authorization = `Bearer ${data.access}`;
          return apiClient.request(originalRequest);
        } else {
          localStorage.clear();
          processQueue(error, null);
          return Promise.reject(error);
        }
      } catch (err) {
        localStorage.clear();
        processQueue(err, null);
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
