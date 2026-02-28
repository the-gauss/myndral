import { ChevronLeft, ChevronRight, Search, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function TopBar() {
  const navigate = useNavigate()

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
      {/* History navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="p-1 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => navigate(1)}
          className="p-1 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Search shortcut */}
      <button
        onClick={() => navigate('/search')}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-sm font-semibold hover:scale-105 transition-transform"
      >
        <Search size={16} />
        Search
      </button>

      {/* User avatar */}
      <button className="p-1 rounded-full bg-elevated hover:bg-highlight transition-colors">
        <User size={20} className="text-white" />
      </button>
    </header>
  )
}
