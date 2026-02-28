import type { AxiosError } from 'axios'
import { LockKeyhole, UserRound } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ui/ThemeToggle'
import { login } from '../services/auth'
import { useUserStore } from '../store/userStore'

function errorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ detail?: string }>
  const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'dev proxy (/v1 -> http://localhost:8000)'

  if (axiosError.code === 'ERR_NETWORK') {
    return `Cannot reach API at ${apiBaseUrl}. Start the backend and retry.`
  }

  return axiosError.response?.data?.detail ?? 'Unable to sign in with those credentials.'
}

export default function Login() {
  const navigate = useNavigate()
  const setUser = useUserStore((s) => s.setUser)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    try {
      const response = await login({ username, password })
      setUser(response.user, response.accessToken)
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-border bg-surface/80 p-8 shadow-xl">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-fg">MyndralAI</p>
          <h1 className="mt-2 text-2xl font-bold">Sign in to continue</h1>
          <p className="mt-1 text-sm text-muted-fg">
            Use your username (or email) and password to access the app.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-fg">
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
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-fg">
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
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
