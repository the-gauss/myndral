import { API_BASE_URL } from '@/src/lib/env';

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

export function resolveApiUrl(pathname: string) {
  if (ABSOLUTE_URL_PATTERN.test(pathname)) {
    return pathname;
  }

  if (pathname.startsWith('/')) {
    return `${API_BASE_URL}${pathname}`;
  }

  return `${API_BASE_URL}/${pathname}`;
}

export function resolveMediaUrl(url?: string | null) {
  if (!url) {
    return undefined;
  }

  return resolveApiUrl(url);
}
