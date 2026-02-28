import { ChevronLeft, ChevronRight, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ThemeToggle from '../ui/ThemeToggle'

export default function TopBar() {
  const navigate = useNavigate()

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
        <button
          className="p-1.5 rounded-full text-muted-fg hover:text-foreground hover:bg-border/40 transition-colors"
          aria-label="Account"
        >
          <User size={18} />
        </button>
      </div>
    </header>
  )
}
