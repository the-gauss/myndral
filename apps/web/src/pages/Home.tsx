import AlbumCard, { AlbumCardSkeleton } from '../components/cards/AlbumCard'
import ArtistCard, { ArtistCardSkeleton } from '../components/cards/ArtistCard'
import TrackRow from '../components/cards/TrackRow'
import SectionHeader from '../components/ui/SectionHeader'
import Skeleton from '../components/ui/Skeleton'
import { useAlbums, useArtists, useFeaturedTracks } from '../hooks/useCatalog'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const albums = useAlbums(12)
  const artists = useArtists(8)
  const featured = useFeaturedTracks(10)

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold text-foreground">{greeting()}</h1>

      {/* New Releases — section only renders when loading or has content */}
      {(albums.isLoading || (albums.data && albums.data.items.length > 0)) && (
        <section>
          <SectionHeader title="New Releases" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {albums.isLoading
              ? Array.from({ length: 6 }).map((_, i) => <AlbumCardSkeleton key={i} />)
              : albums.data?.items.map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
          </div>
        </section>
      )}

      {/* Artists */}
      {(artists.isLoading || (artists.data && artists.data.items.length > 0)) && (
        <section>
          <SectionHeader title="Artists" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {artists.isLoading
              ? Array.from({ length: 8 }).map((_, i) => <ArtistCardSkeleton key={i} />)
              : artists.data?.items.map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} />
                ))}
          </div>
        </section>
      )}

      {/* Trending Tracks */}
      {(featured.isLoading || (featured.data && featured.data.items.length > 0)) && (
        <section>
          <SectionHeader title="Trending" />
          {featured.isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-3 py-2">
                  <Skeleton className="w-4 h-4" />
                  <Skeleton className="flex-1 h-4" />
                  <Skeleton className="w-10 h-4" />
                </div>
              ))
            : featured.data?.items.map((track, i) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={i + 1}
                  queue={featured.data?.items}
                  showAlbum
                />
              ))}
        </section>
      )}
    </div>
  )
}
