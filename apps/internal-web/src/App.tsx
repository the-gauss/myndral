import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import { getInternalMe } from './services/internal'
import { useAuthStore } from './store/authStore'

const INTERNAL_ROLES = new Set(['content_editor', 'content_reviewer', 'admin'])

export default function App() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setSession = useAuthStore((s) => s.setSession)
  const clearSession = useAuthStore((s) => s.clearSession)

  const [checked, setChecked] = useState(false)

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

  return isAuthenticated ? <Dashboard /> : <Login />
}
