import axios, { type AxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/src/lib/env';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function withBearerToken(token?: string | null): AxiosRequestConfig {
  if (!token) {
    return {};
  }

  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export default api;
