import { Home, Library, Search } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/',        label: 'Home',    Icon: Home    },
  { to: '/search',  label: 'Search',  Icon: Search  },
  { to: '/library', label: 'Library', Icon: Library },
]

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-64 shrink-0 gap-2">
      {/* Navigation */}
      <nav className="rounded-lg bg-surface p-4">
        <ul className="space-y-1">
          {navItems.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-3 py-2 rounded font-semibold text-sm transition-colors
                   ${isActive ? 'text-white' : 'text-muted hover:text-white'}`
                }
              >
                <Icon size={24} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Library panel */}
      <div className="flex-1 rounded-lg bg-surface p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="flex items-center gap-2 text-muted hover:text-white cursor-pointer font-semibold text-sm">
            <Library size={24} />
            Your Library
          </span>
        </div>
        {/* TODO: render user's playlists, liked albums, followed artists */}
        <p className="text-subtle text-xs">Your library is empty.</p>
      </div>
    </aside>
  )
}
