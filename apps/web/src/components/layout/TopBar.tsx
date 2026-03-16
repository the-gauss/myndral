import { ChevronDown, ChevronLeft, ChevronRight, CreditCard, ExternalLink, LogOut, Settings2, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  function logout() {
    clearUser()
    navigate('/login', { replace: true })
  }

  function openAccount(hash?: string) {
    navigate(hash ? `/account${hash}` : '/account')
    setMenuOpen(false)
  }

  return (
    <header className="glass-toolbar relative z-30 mx-4 mt-4 flex shrink-0 items-center justify-between rounded-[28px] px-6 py-3">
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
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((current) => !current)}
            className="glass-pill flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-muted-fg hover:text-foreground"
            aria-label="Open account menu"
          >
            <User size={18} />
            <span className="max-w-32 truncate text-xs font-medium">
              {user?.displayName ?? user?.username ?? 'Account'}
            </span>
            <ChevronDown size={14} />
          </button>

          {menuOpen && (
            <div className="glass-panel-strong absolute right-0 z-50 mt-2 w-60 rounded-2xl p-2">
              <button
                onClick={() => openAccount('#profile')}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/5"
              >
                <User size={14} />
                Profile & account
              </button>
              <button
                onClick={() => openAccount('#billing')}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/5"
              >
                <CreditCard size={14} />
                Billing & subscription
              </button>
              <button
                onClick={() => openAccount('#settings')}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/5"
              >
                <Settings2 size={14} />
                Settings
              </button>
              <div className="mx-2 my-1 border-t border-border/60" />
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/5"
              >
                <LogOut size={14} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
