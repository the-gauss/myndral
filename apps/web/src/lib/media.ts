const ABSOLUTE_URL_RE = /^[a-z][a-z\d+.-]*:/i

function getApiBaseUrl() {
  const baseUrl = (import.meta.env.VITE_API_URL ?? '').trim()
  if (!baseUrl) return ''
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (ABSOLUTE_URL_RE.test(url) || url.startsWith('//')) return url

  const apiBaseUrl = getApiBaseUrl()
  if (!apiBaseUrl) return url

  const normalizedPath = url.startsWith('/') ? url : `/${url}`
  return new URL(normalizedPath, apiBaseUrl).toString()
}
