import type { AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/src/stores/authStore';

export function authedRequest(config: AxiosRequestConfig = {}): AxiosRequestConfig {
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    return config;
  }

  return {
    ...config,
    headers: {
      ...(config.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  };
}
