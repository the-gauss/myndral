import type { AxiosError } from 'axios'
import { LockKeyhole, UserRound } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { internalLogin } from '../services/internal'
import { useAuthStore } from '../store/authStore'

function loginError(error: unknown): string {
  const axiosError = error as AxiosError<{ detail?: string }>
  if (axiosError.code === 'ERR_NETWORK') {
    return 'Cannot reach backend API. Ensure API is running at http://127.0.0.1:8000.'
  }
  return axiosError.response?.data?.detail ?? 'Unable to sign in. Check credentials and try again.'
}

export default function Login() {
  const setSession = useAuthStore((s) => s.setSession)
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
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-2xl shadow-black/30">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-fg">Myndral Studio</p>
        <h1 className="text-3xl font-bold mt-2">Employee Sign In</h1>
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
                className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none ring-accent/60 transition focus:ring-2"
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
                className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none ring-accent/60 transition focus:ring-2"
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
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
