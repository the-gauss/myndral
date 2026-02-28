import TrackRow from '../components/cards/TrackRow'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import { useTracks } from '../hooks/useCatalog'

export default function Songs() {
  const { data, isLoading } = useTracks(100)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Songs</h1>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-2">
              <Skeleton className="w-4 h-4" />
              <Skeleton className="flex-1 h-4" />
              <Skeleton className="w-10 h-4" />
            </div>
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <section>
          {data.items.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i + 1}
              queue={data.items}
              showAlbum
            />
          ))}
        </section>
      ) : (
        <EmptyState message="No songs are published yet." />
      )}
    </div>
  )
}
