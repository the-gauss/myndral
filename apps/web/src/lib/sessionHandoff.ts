const ACCESS_TOKEN_KEY = 'access_token'

function readInitialHandoffToken() {
  if (typeof window === 'undefined') return null

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  const params = new URLSearchParams(hash)
  const handoffToken = params.get('handoffToken')?.trim() || null

  if (params.has('handoffToken')) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }

  return handoffToken
}

const initialHandoffToken = readInitialHandoffToken()

export function getInitialWebAccessToken() {
  if (typeof window === 'undefined') return null

  if (initialHandoffToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, initialHandoffToken)
    return initialHandoffToken
  }

  return localStorage.getItem(ACCESS_TOKEN_KEY)
}
