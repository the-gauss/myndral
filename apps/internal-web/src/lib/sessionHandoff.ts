import { INTERNAL_ACCESS_TOKEN_KEY } from '../services/api'

export type StudioEntryView = 'login' | 'register'
export type StudioRegisterMode = 'new' | 'existing'

interface StudioEntry {
  handoffToken: string | null
  clearSession: boolean
  view: StudioEntryView
  mode: StudioRegisterMode
  identifier: string
}

function readInitialStudioEntry(): StudioEntry {
  if (typeof window === 'undefined') {
    return { handoffToken: null, clearSession: false, view: 'login', mode: 'new', identifier: '' }
  }

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  const params = new URLSearchParams(hash)
  const hasKnownParam = ['handoffToken', 'clearSession', 'view', 'mode', 'identifier'].some((key) => params.has(key))

  if (hasKnownParam) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }

  const rawView = params.get('view')
  const rawMode = params.get('mode')

  return {
    handoffToken: params.get('handoffToken')?.trim() || null,
    clearSession: params.get('clearSession') === '1',
    view: rawView === 'register' ? 'register' : 'login',
    mode: rawMode === 'existing' ? 'existing' : 'new',
    identifier: params.get('identifier')?.trim() || '',
  }
}

export const initialStudioEntry = readInitialStudioEntry()

export function getInitialStudioAccessToken() {
  if (typeof window === 'undefined') return null

  if (initialStudioEntry.handoffToken) {
    localStorage.setItem(INTERNAL_ACCESS_TOKEN_KEY, initialStudioEntry.handoffToken)
    return initialStudioEntry.handoffToken
  }
  if (initialStudioEntry.clearSession) {
    localStorage.removeItem(INTERNAL_ACCESS_TOKEN_KEY)
    return null
  }

  return localStorage.getItem(INTERNAL_ACCESS_TOKEN_KEY)
}
