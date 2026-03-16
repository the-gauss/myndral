import type { AxiosError } from 'axios'
import { LockKeyhole, Mail, UserRound } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ui/ThemeToggle'
import { register } from '../services/auth'
import type { AuthResponse } from '../services/auth'

function errorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ detail?: string }>
  if (axiosError.code === 'ERR_NETWORK') {
    const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'dev proxy'
    return `Cannot reach API at ${apiBaseUrl}. Start the backend and retry.`
  }
  return axiosError.response?.data?.detail ?? 'Registration failed. Please try again.'
}

export default function Register() {
  const navigate = useNavigate()

  const [username, setUsername]       = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [confirm, setConfirm]         = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError]             = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const auth: AuthResponse = await register({ username, email, password })
      // Don't call setUser here — the user hasn't chosen a plan yet.
      // Pass the auth payload forward via router state so ChoosePlan can
      // complete the login once a plan is selected.
      navigate('/choose-plan', { replace: true, state: { auth } })
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
          <h1 className="mt-2 text-2xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-fg">
            AI-generated music, no real artists — just pure sound.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-fg">
              Username
            </span>
            <div className="relative">
              <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                minLength={3}
                maxLength={50}
                pattern="^[a-zA-Z0-9_]+$"
                title="Letters, numbers, and underscores only"
                className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none ring-accent/60 transition focus:ring-2"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-fg">
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
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none ring-accent/60 transition focus:ring-2"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-fg">
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
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-fg">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Login here
          </Link>
        </p>
      </div>
    </div>
  )
}
