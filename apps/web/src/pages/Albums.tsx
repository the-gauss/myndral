import AlbumCard, { AlbumCardSkeleton } from '../components/cards/AlbumCard'
import EmptyState from '../components/ui/EmptyState'
import { useAlbums } from '../hooks/useCatalog'

export default function Albums() {
  const { data, isLoading } = useAlbums(36)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Albums</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {Array.from({ length: 12 }).map((_, i) => <AlbumCardSkeleton key={i} />)}
        </div>
      ) : data && data.items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {data.items.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      ) : (
        <EmptyState message="No albums are published yet." />
      )}
    </div>
  )
}
