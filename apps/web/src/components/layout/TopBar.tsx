import { ChevronLeft, ChevronRight, ExternalLink, LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { buildStudioAppUrl, userHasStudioAccess } from '../../lib/crossApp'
import { useUserStore } from '../../store/userStore'
import ThemeToggle from '../ui/ThemeToggle'

export default function TopBar() {
  const navigate = useNavigate()
  const user = useUserStore((s) => s.user)
  const accessToken = useUserStore((s) => s.accessToken)
  const clearUser = useUserStore((s) => s.clearUser)
  const hasStudioAccess = userHasStudioAccess(user?.role)
  const studioHref = hasStudioAccess
    ? buildStudioAppUrl({ accessToken })
    : buildStudioAppUrl({
        view: 'register',
        registerMode: 'existing',
        identifier: user?.username,
        clearSession: true,
      })
  const studioLabel = hasStudioAccess ? 'Studio' : 'Get Studio Access'
  const studioTitle = hasStudioAccess
    ? 'Open the internal studio'
    : 'Open the studio access claim flow'

  function logout() {
    clearUser()
    navigate('/login', { replace: true })
  }

  return (
    <header className="glass-panel flex shrink-0 items-center justify-between border-b border-border/60 px-6 py-3">
      {/* History navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => navigate(-1)}
          className="glass-pill p-2 text-muted-fg hover:text-foreground"
          aria-label="Go back"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => navigate(1)}
          className="glass-pill p-2 text-muted-fg hover:text-foreground"
          aria-label="Go forward"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <a
          href={studioHref}
          className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-muted-fg hover:text-foreground"
          title={studioTitle}
        >
          <ExternalLink size={14} />
          {studioLabel}
        </a>
        <ThemeToggle />
        <div className="glass-pill flex items-center gap-2 rounded-full py-1 pl-1 pr-2">
          <User size={18} />
          <span className="text-xs font-medium text-muted-fg max-w-32 truncate">
            {user?.displayName ?? user?.username ?? 'Account'}
          </span>
          <button
            onClick={logout}
            className="rounded p-1 text-muted-fg hover:bg-foreground/10 hover:text-foreground"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}
