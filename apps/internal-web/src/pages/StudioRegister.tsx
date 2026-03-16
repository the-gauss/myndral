import type { AxiosError } from 'axios'
import { ExternalLink, KeyRound, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { buildWebAppUrl } from '../lib/crossApp'
import type { StudioRegisterMode } from '../lib/sessionHandoff'
import { studioRegister, studioClaim } from '../services/internal'
import { useAuthStore } from '../store/authStore'

// ─────────────────────────────────────────────────────────────────────────────
// Two modes:
//   new      — create a fresh account, role comes from the access token
//   existing — verify existing credentials and upgrade role via access token
// ─────────────────────────────────────────────────────────────────────────────

function apiError(error: unknown): string {
  const e = error as AxiosError<{ detail?: string }>
  if (e.code === 'ERR_NETWORK') return 'Cannot reach backend API.'
  return e.response?.data?.detail ?? 'Something went wrong. Please try again.'
}

interface Props {
  initialMode?: StudioRegisterMode
  initialIdentifier?: string
  onBack: () => void
}

export default function StudioRegister({
  initialMode = 'new',
  initialIdentifier = '',
  onBack,
}: Props) {
  const setSession = useAuthStore((s) => s.setSession)
  const webPlayerUrl = buildWebAppUrl()

  const [mode, setMode]             = useState<StudioRegisterMode>(initialMode)
  const [username, setUsername]     = useState(initialIdentifier)
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  function switchMode(m: StudioRegisterMode) {
    setMode(m)
    setError(null)
    setUsername('')
    setEmail('')
    setPassword('')
    setConfirm('')
    setAccessToken('')
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (mode === 'new' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const response = mode === 'new'
        ? await studioRegister({ username, email, password, studio_access_token: accessToken })
        : await studioClaim({ username, password, studio_access_token: accessToken })

      setSession(response.user, response.accessToken)
    } catch (err) {
      setError(apiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <a
        href={webPlayerUrl}
        className="absolute right-6 top-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-fg transition hover:text-foreground"
      >
        <ExternalLink size={14} />
        Web Player
      </a>
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-2xl shadow-black/30">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-fg">Myndral Studio</p>
        <h1 className="text-3xl font-bold mt-2">Claim Studio Access</h1>
        <p className="text-sm text-muted-fg mt-2">
          Paste the access token you received to activate your role.
        </p>

        {/* Mode tabs */}
        <div className="mt-6 flex rounded-lg border border-border overflow-hidden text-sm font-medium">
          <button
            type="button"
            onClick={() => switchMode('new')}
            className={`flex-1 py-2 transition ${
              mode === 'new'
                ? 'bg-accent text-accent-fg'
                : 'bg-background text-muted-fg hover:text-foreground'
            }`}
          >
            New user
          </button>
          <button
            type="button"
            onClick={() => switchMode('existing')}
            className={`flex-1 py-2 transition border-l border-border ${
              mode === 'existing'
                ? 'bg-accent text-accent-fg'
                : 'bg-background text-muted-fg hover:text-foreground'
            }`}
          >
            Already have an account
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {/* Username */}
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-fg block mb-1.5">
              Username {mode === 'existing' ? 'or Email' : ''}
            </span>
            <div className="relative">
              <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                minLength={mode === 'new' ? 3 : 1}
                maxLength={50}
                pattern={mode === 'new' ? '^[a-zA-Z0-9_]+$' : undefined}
                title={mode === 'new' ? 'Letters, numbers, and underscores only' : undefined}
                className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none ring-accent/60 transition focus:ring-2"
              />
            </div>
          </label>

          {/* Email — only for new accounts */}
          {mode === 'new' && (
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-fg block mb-1.5">
                Email
              </span>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none ring-accent/60 transition focus:ring-2"
                />
              </div>
            </label>
          )}

          {/* Password */}
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-fg block mb-1.5">
              Password
            </span>
            <div className="relative">
              <LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'new' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'new' ? 8 : 1}
                className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none ring-accent/60 transition focus:ring-2"
              />
            </div>
          </label>

          {/* Confirm password — new accounts only */}
          {mode === 'new' && (
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-fg block mb-1.5">
                Confirm Password
              </span>
              <div className="relative">
                <LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none ring-accent/60 transition focus:ring-2"
                />
              </div>
            </label>
          )}

          {/* Studio access token */}
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-fg block mb-1.5">
              Studio Access Token
            </span>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg" />
              <input
                type="text"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                autoComplete="off"
                required
                placeholder="Paste the token you received"
                className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-sm font-mono outline-none ring-accent/60 transition focus:ring-2"
              />
            </div>
          </label>

          {error && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition hover:opacity-95 disabled:opacity-60"
          >
            {submitting
              ? 'Processing...'
              : mode === 'new' ? 'Create account & activate' : 'Verify & activate role'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-fg">
          Already activated?{' '}
          <button
            type="button"
            onClick={onBack}
            className="font-medium text-accent hover:underline"
          >
            Sign in here
          </button>
        </p>
      </div>
    </div>
  )
}
