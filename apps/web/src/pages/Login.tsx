import type { AxiosError } from 'axios'
import { LockKeyhole, UserRound } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center overflow-hidden px-4">
      <div className="absolute top-6 right-6 z-10">
        <ThemeToggle />
      </div>

      <div className="glass-panel-strong soft-enter w-full max-w-md rounded-[32px] p-8 shadow-xl">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-fg">MyndralAI</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Sign in to continue</h1>
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
                className="glass-input w-full rounded-2xl py-3 pl-10 pr-3 text-sm"
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
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg shadow-lg shadow-accent/20 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-fg">
          New user?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  )
}
