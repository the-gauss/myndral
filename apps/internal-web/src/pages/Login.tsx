import type { AxiosError } from 'axios'
import { ExternalLink, LockKeyhole, UserRound } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { buildWebAppUrl } from '../lib/crossApp'
import { internalLogin } from '../services/internal'
import { useAuthStore } from '../store/authStore'

function loginError(error: unknown): string {
  const axiosError = error as AxiosError<{ detail?: string }>
  if (axiosError.code === 'ERR_NETWORK') {
    return 'Cannot reach backend API. Ensure API is running at http://127.0.0.1:8000.'
  }
  return axiosError.response?.data?.detail ?? 'Unable to sign in. Check credentials and try again.'
}

interface Props {
  onRegister: () => void
}

export default function Login({ onRegister }: Props) {
  const setSession = useAuthStore((s) => s.setSession)
  const webPlayerUrl = buildWebAppUrl()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)
    try {
      const response = await internalLogin({ username, password })
      setSession(response.user, response.accessToken)
    } catch (err) {
      setError(loginError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center overflow-hidden p-6">
      <a
        href={webPlayerUrl}
        className="glass-pill absolute right-6 top-6 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-muted-fg transition hover:text-foreground"
      >
        <ExternalLink size={14} />
        Web Player
      </a>
      <div className="glass-panel-strong soft-enter w-full max-w-md rounded-[32px] p-8 shadow-2xl shadow-black/30">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-fg">Myndral Studio</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Employee Sign In</h1>
        <p className="text-sm text-muted-fg mt-2">
          Access internal catalog management and publishing workflows.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-fg block mb-1.5">
              Username or Email
            </span>
            <div className="relative">
              <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="glass-input w-full rounded-2xl py-3 pl-10 pr-3 text-sm"
              />
            </div>
          </label>

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
                autoComplete="current-password"
                required
                className="glass-input w-full rounded-2xl py-3 pl-10 pr-3 text-sm"
              />
            </div>
          </label>

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg shadow-lg shadow-accent/20 hover:-translate-y-0.5 disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-fg">
          Have an access token?{' '}
          <button
            type="button"
            onClick={onRegister}
            className="font-medium text-accent hover:underline"
          >
            Activate studio access
          </button>
        </p>
      </div>
    </div>
  )
}
