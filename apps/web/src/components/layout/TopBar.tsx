import { ChevronLeft, ChevronRight, LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../../store/userStore'
import ThemeToggle from '../ui/ThemeToggle'

export default function TopBar() {
  const navigate = useNavigate()
  const user = useUserStore((s) => s.user)
  const clearUser = useUserStore((s) => s.clearUser)

  function logout() {
    clearUser()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex items-center justify-between px-6 py-2.5 shrink-0 border-b border-border/40">
      {/* History navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-full text-muted-fg hover:text-foreground hover:bg-border/40 transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => navigate(1)}
          className="p-1.5 rounded-full text-muted-fg hover:text-foreground hover:bg-border/40 transition-colors"
          aria-label="Go forward"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-border/70 bg-background/70">
          <User size={18} />
          <span className="text-xs font-medium text-muted-fg max-w-32 truncate">
            {user?.displayName ?? user?.username ?? 'Account'}
          </span>
          <button
            onClick={logout}
            className="p-1 rounded text-muted-fg hover:text-foreground hover:bg-border/40 transition-colors"
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
