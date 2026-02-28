import { Music } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import { useUserPlaylists } from '../hooks/useCatalog'

export default function Library() {
  const { data, isLoading } = useUserPlaylists()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Your Library</h1>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <Skeleton className="w-12 h-12 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && data && data.items.length > 0 && (
        <ul className="space-y-1">
          {data.items.map((pl) => (
            <li key={pl.id}>
              <Link
                to={`/playlist/${pl.id}`}
                className="flex items-center gap-4 px-3 py-2 rounded-lg hover:bg-surface transition-colors"
              >
                <div className="w-12 h-12 rounded bg-border shrink-0 overflow-hidden">
                  {pl.coverUrl
                    ? <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <Music size={18} className="text-muted-fg" />
                      </div>
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{pl.name}</p>
                  <p className="text-xs text-muted-fg">
                    {pl.isAiCurated ? 'AI Curated · ' : ''}
                    {pl.tracks.length} {pl.tracks.length === 1 ? 'song' : 'songs'}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && (!data || data.items.length === 0) && (
        <EmptyState message="Your library is empty. Follow some artists to get started." />
      )}
    </div>
  )
}
