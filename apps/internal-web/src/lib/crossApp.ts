const DEFAULT_WEB_URL = 'https://app.myndral.com'

interface WebAppUrlOptions {
  accessToken?: string | null
}

function inferWebUrlFromOrigin() {
  if (typeof window === 'undefined') return DEFAULT_WEB_URL

  const current = new URL(window.location.origin)
  if (current.hostname === 'localhost' || current.hostname === '127.0.0.1') {
    current.port = '5173'
    return current.origin
  }
  if (current.hostname.startsWith('studio.')) {
    current.hostname = current.hostname.replace(/^studio\./, 'app.')
    return current.origin
  }

  return DEFAULT_WEB_URL
}

function getWebBaseUrl() {
  const configured = (import.meta.env.VITE_WEB_URL ?? '').trim()
  return (configured || inferWebUrlFromOrigin()).replace(/\/$/, '')
}

export function buildWebAppUrl({ accessToken }: WebAppUrlOptions = {}) {
  const url = new URL(getWebBaseUrl())
  if (accessToken) {
    const hashParams = new URLSearchParams()
    hashParams.set('handoffToken', accessToken)
    url.hash = hashParams.toString()
  }
  return url.toString()
}
