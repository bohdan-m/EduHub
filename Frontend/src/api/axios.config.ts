import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { authApi } from './auth.api';
import { useUserStore } from '../store/store';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: `${apiBaseUrl.replace(/\/$/, '')}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000, 
});

apiClient.interceptors.request.use((config) => {
  if (config.url?.includes('/refresh/')) {
    return config;
  }

  const { user } = useUserStore.getState();
  if (user?.access) {
    config.headers.Authorization = `Bearer ${user.access}`;
  }

  return config;
});

interface QueueItem {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

let isRefreshing = false;
let failedQueue: QueueItem[] = [];

const processQueue = (
  error: unknown | null = null,
  token: string | null = null
) => {
  failedQueue.forEach((item) => {
    if (error) {
      item.reject(error);
    } else if (token) {
      item.resolve(token);
    }
  });

  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!error.response || !originalRequest) {
      return Promise.reject(error);
    }

    const { status } = error.response;
    const { user, updateTokens, logout } = useUserStore.getState();

    if (originalRequest.url?.includes('/refresh/') && status === 401) {
      console.log('Refresh token expired, logging out...');
      logout();
      return Promise.reject(error);
    }

    if (status === 401 && user?.refresh) {
      if (originalRequest._retry) {
        console.log('Retry failed, logging out...');
        logout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(
            (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return apiClient(originalRequest);
            },
            // refresh failed and the user was logged out: retry as a guest, like the request that triggered it
            () => {
              delete originalRequest.headers.Authorization;
              return apiClient(originalRequest);
            }
          );
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const data = await authApi.refresh({ refresh: user.refresh });

        updateTokens(data.access, data.refresh);
        processQueue(null, data.access);

        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return apiClient(originalRequest);

      } catch (refreshError: unknown) {
        const axiosError = refreshError as AxiosError;
      
        console.log('Refresh failed:', axiosError.response?.status);
      
        logout();
        processQueue(refreshError, null);

        // The saved session is dead (expired, or the database was reset). Retry once as a guest so public
        // endpoints like the course list still load; protected ones 401 again and reject, since user is now null.
        delete originalRequest.headers.Authorization;
        return apiClient(originalRequest);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);