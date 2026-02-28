import ArtistCard, { ArtistCardSkeleton } from '../components/cards/ArtistCard'
import EmptyState from '../components/ui/EmptyState'
import { useArtists } from '../hooks/useCatalog'

export default function Artists() {
  const { data, isLoading } = useArtists(48)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Artists</h1>

      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {Array.from({ length: 16 }).map((_, i) => <ArtistCardSkeleton key={i} />)}
        </div>
      ) : data && data.items.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {data.items.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      ) : (
        <EmptyState message="No artists are published yet." />
      )}
    </div>
  )
}
