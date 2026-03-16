import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import StudioRegister from './pages/StudioRegister'
import { initialStudioEntry } from './lib/sessionHandoff'
import { getInternalMe } from './services/internal'
import { useAuthStore } from './store/authStore'

const INTERNAL_ROLES = new Set(['content_editor', 'content_reviewer', 'admin'])

type View = 'login' | 'register'

export default function App() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setSession = useAuthStore((s) => s.setSession)
  const clearSession = useAuthStore((s) => s.clearSession)

  const [checked, setChecked] = useState(false)
  const [view, setView] = useState<View>(initialStudioEntry.view)
  const [registerMode, setRegisterMode] = useState(initialStudioEntry.mode)
  const [registerIdentifier, setRegisterIdentifier] = useState(initialStudioEntry.identifier)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!accessToken) {
        if (!cancelled) setChecked(true)
        return
      }

      try {
        const me = await getInternalMe()
        if (!INTERNAL_ROLES.has(me.role)) {
          throw new Error('unauthorized-role')
        }
        if (!cancelled) setSession(me, accessToken)
      } catch {
        if (!cancelled) clearSession()
      } finally {
        if (!cancelled) setChecked(true)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [accessToken, clearSession, setSession])

  if (!checked) {
    return (
      <div className="h-screen bg-background text-foreground flex items-center justify-center text-sm text-muted-fg">
        Verifying employee session...
      </div>
    )
  }

  if (isAuthenticated) return <Dashboard />

  if (view === 'register') {
    return (
      <StudioRegister
        initialMode={registerMode}
        initialIdentifier={registerIdentifier}
        onBack={() => {
          setView('login')
          setRegisterMode('new')
          setRegisterIdentifier('')
        }}
      />
    )
  }

  return (
    <Login
      onRegister={() => {
        setRegisterMode('new')
        setRegisterIdentifier('')
        setView('register')
      }}
    />
  )
}
