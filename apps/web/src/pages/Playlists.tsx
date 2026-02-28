import { Music } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import { usePlaylists } from '../hooks/useCatalog'

export default function Playlists() {
  const { data, isLoading } = usePlaylists(36)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Playlists</h1>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <Skeleton className="w-12 h-12 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <ul className="space-y-1">
          {data.items.map((playlist) => (
            <li key={playlist.id}>
              <Link
                to={`/playlist/${playlist.id}`}
                className="flex items-center gap-4 px-3 py-2 rounded-lg hover:bg-surface transition-colors"
              >
                <div className="w-12 h-12 rounded bg-border shrink-0 overflow-hidden">
                  {playlist.coverUrl ? (
                    <img
                      src={playlist.coverUrl}
                      alt={playlist.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music size={18} className="text-muted-fg" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{playlist.name}</p>
                  <p className="text-xs text-muted-fg">
                    {playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}
                    {playlist.isAiCurated ? ' · AI Curated' : ''}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message="No playlists found." />
      )}
    </div>
  )
}
