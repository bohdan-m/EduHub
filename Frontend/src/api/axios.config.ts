import axios, { type InternalAxiosRequestConfig } from 'axios';
import { authClient } from '@/lib/auth-client';
import { createTokenCache } from '@/utils/tokenCache';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: `${apiBaseUrl.replace(/\/$/, '')}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Short-lived JWT for the FastAPI backend. get-session carries it in a `set-auth-jwt` header when signed in,
// and answers 200 with no session for guests (the /token endpoint would log a 401 on every page load).
export const apiToken = createTokenCache(async () => {
  let token: string | null = null;
  await authClient.getSession({
    fetchOptions: {
      onSuccess: (ctx) => {
        token = ctx.response.headers.get('set-auth-jwt');
      },
    },
  });
  return token;
});

apiClient.interceptors.request.use(async (config) => {
  const token = await apiToken.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const request = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (error.response?.status !== 401 || !request || request._retried) {
      return Promise.reject(error);
    }
    // The token was rejected (expired, keys rotated, session ended): get a fresh one, or none, and retry once.
    // Public endpoints then still load as a guest; protected ones fail with 401 again.
    request._retried = true;
    apiToken.clear();
    delete request.headers.Authorization;
    return apiClient(request);
  }
);
