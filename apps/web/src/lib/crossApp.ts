import type { UserRole } from '../types'

const INTERNAL_ROLES = new Set<UserRole>(['content_editor', 'content_reviewer', 'admin'])
const DEFAULT_STUDIO_URL = 'https://studio.myndral.com'

type StudioEntryView = 'login' | 'register'
type StudioRegisterMode = 'new' | 'existing'

interface StudioAppUrlOptions {
  accessToken?: string | null
  view?: StudioEntryView
  registerMode?: StudioRegisterMode
  identifier?: string | null
  clearSession?: boolean
}

function inferStudioUrlFromOrigin() {
  if (typeof window === 'undefined') return DEFAULT_STUDIO_URL

  const current = new URL(window.location.origin)
  if (current.hostname === 'localhost' || current.hostname === '127.0.0.1') {
    current.port = '5174'
    return current.origin
  }
  if (current.hostname.startsWith('app.')) {
    current.hostname = current.hostname.replace(/^app\./, 'studio.')
    return current.origin
  }

  return DEFAULT_STUDIO_URL
}

function getStudioBaseUrl() {
  const configured = (import.meta.env.VITE_STUDIO_URL ?? '').trim()
  return (configured || inferStudioUrlFromOrigin()).replace(/\/$/, '')
}

export function userHasStudioAccess(role?: UserRole | null) {
  return Boolean(role && INTERNAL_ROLES.has(role))
}

export function buildStudioAppUrl({
  accessToken,
  view = 'login',
  registerMode,
  identifier,
  clearSession = false,
}: StudioAppUrlOptions = {}) {
  const url = new URL(getStudioBaseUrl())
  const hashParams = new URLSearchParams()

  if (accessToken) hashParams.set('handoffToken', accessToken)
  if (clearSession) hashParams.set('clearSession', '1')
  if (view !== 'login') hashParams.set('view', view)
  if (registerMode) hashParams.set('mode', registerMode)
  if (identifier?.trim()) hashParams.set('identifier', identifier.trim())

  url.hash = hashParams.toString()
  return url.toString()
}
