import { Album, Home, Library, ListMusic, Mic2, Music, Search } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useUserPlaylists } from '../../hooks/useCatalog'
import { resolveMediaUrl } from '../../lib/media'

const navItems = [
  { to: '/',         label: 'Home',      Icon: Home },
  { to: '/search',   label: 'Search',    Icon: Search },
  { to: '/artists',  label: 'Artists',   Icon: Mic2 },
  { to: '/albums',   label: 'Albums',    Icon: Album },
  { to: '/songs',    label: 'Songs',     Icon: Music },
  { to: '/playlists', label: 'Playlists', Icon: ListMusic },
]

export default function Sidebar() {
  const { data: playlists } = useUserPlaylists()

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-3">
      {/* Browse nav */}
      <nav className="glass-panel soft-enter rounded-[28px] px-3 py-4">
        <p className="px-3 pb-2 text-xs font-semibold tracking-wide uppercase text-muted-fg">Browse</p>
        <ul className="space-y-0.5">
          {navItems.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                   `surface-hover flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold
                   ${isActive
                     ? 'bg-accent/12 text-foreground shadow-sm'
                     : 'text-muted-fg hover:bg-foreground/5 hover:text-foreground'}`
                }
              >
                <Icon size={22} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Library */}
      <div className="glass-panel soft-enter flex flex-1 flex-col overflow-hidden rounded-[28px]">
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <Library size={20} className="text-muted-fg" />
          <Link
            to="/library"
            className="text-sm font-semibold text-muted-fg hover:text-foreground transition-colors"
          >
            Your Library
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {playlists && playlists.items.length > 0 ? (
            <ul className="space-y-0.5">
              {playlists.items.map((pl) => {
                const coverUrl = resolveMediaUrl(pl.coverUrl)

                return (
                  <li key={pl.id}>
                    <NavLink
                      to={`/playlist/${pl.id}`}
                      className={({ isActive }) =>
                        `surface-hover flex items-center gap-3 rounded-2xl px-3 py-2.5
                         ${isActive
                           ? 'bg-accent/10 text-foreground shadow-sm'
                           : 'text-muted-fg hover:bg-foreground/5 hover:text-foreground'}`
                      }
                    >
                      <div className="w-9 h-9 rounded-xl bg-surface/70 shrink-0 overflow-hidden">
                        {coverUrl
                          ? <img src={coverUrl} alt={pl.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Music size={14} className="text-muted-fg" /></div>
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">{pl.name}</p>
                        <p className="text-xs text-muted-fg truncate">
                          {pl.isAiCurated ? 'AI Curated' : 'Playlist'}
                        </p>
                      </div>
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-3 text-xs text-muted-fg">No playlists yet.</p>
          )}
        </div>
      </div>
    </aside>
  )
}
