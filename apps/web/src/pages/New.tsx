import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AlbumCard, { AlbumCardSkeleton } from '../components/cards/AlbumCard'
import ArtistCard, { ArtistCardSkeleton } from '../components/cards/ArtistCard'
import TrackRow from '../components/cards/TrackRow'
import EmptyState from '../components/ui/EmptyState'
import SectionHeader from '../components/ui/SectionHeader'
import Skeleton from '../components/ui/Skeleton'
import { useAlbums, useArtists, useCollectionState, usePlaylists, useTracks } from '../hooks/useCatalog'

type NewSection = 'all' | 'artists' | 'albums' | 'songs' | 'playlists'

export default function New() {
  const [searchParams] = useSearchParams()
  const activeSection = (searchParams.get('section') as NewSection | null) ?? 'all'
  const albums = useAlbums(12)
  const artists = useArtists(8)
  const tracks = useTracks(12)
  const playlists = usePlaylists(8)
  const collection = useCollectionState({
    trackIds: tracks.data?.items.map((track) => track.id) ?? [],
  })
  const favoriteTrackIds = useMemo(
    () => new Set(collection.data?.favorites.trackIds ?? []),
    [collection.data?.favorites.trackIds],
  )
  const libraryTrackIds = useMemo(
    () => new Set(collection.data?.library.trackIds ?? []),
    [collection.data?.library.trackIds],
  )

  const showAll = activeSection === 'all'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-foreground">New</h1>
        <p className="mt-2 text-sm text-muted-fg">
          Fresh catalog picks grouped by artists, albums, songs, and playlists.
        </p>
      </div>

      {(showAll || activeSection === 'albums') && (
        <section>
          <SectionHeader title="New Releases" />
          {albums.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, index) => <AlbumCardSkeleton key={index} />)}
            </div>
          ) : albums.data?.items.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {albums.data.items.map((album) => <AlbumCard key={album.id} album={album} />)}
            </div>
          ) : (
            <EmptyState message="No new releases are available yet." />
          )}
        </section>
      )}

      {(showAll || activeSection === 'artists') && (
        <section>
          <SectionHeader title="Artists" />
          {artists.isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {Array.from({ length: 8 }).map((_, index) => <ArtistCardSkeleton key={index} />)}
            </div>
          ) : artists.data?.items.length ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {artists.data.items.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
            </div>
          ) : (
            <EmptyState message="No artists are newly available yet." />
          )}
        </section>
      )}

      {(showAll || activeSection === 'songs') && (
        <section>
          <SectionHeader title="Songs" />
          {tracks.isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 px-3 py-2">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="flex-1 h-4" />
                <Skeleton className="w-10 h-4" />
              </div>
            ))
          ) : tracks.data?.items.length ? (
            tracks.data.items.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index + 1}
                queue={tracks.data?.items}
                showAlbum
                isFavorite={favoriteTrackIds.has(track.id)}
                isInLibrary={libraryTrackIds.has(track.id)}
              />
            ))
          ) : (
            <EmptyState message="No new songs are available yet." />
          )}
        </section>
      )}

      {(showAll || activeSection === 'playlists') && (
        <section>
          <SectionHeader title="Playlists" />
          {playlists.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 py-2">
                  <Skeleton className="w-12 h-12 rounded" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              ))}
            </div>
          ) : playlists.data?.items.length ? (
            <div className="space-y-1">
              {playlists.data.items.map((playlist) => (
                <Link
                  key={playlist.id}
                  to={`/playlist/${playlist.id}`}
                  className="surface-hover flex items-center justify-between rounded-2xl border border-border/40 bg-background/20 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{playlist.name}</p>
                    <p className="text-xs text-muted-fg">
                      {playlist.trackCount ?? playlist.tracks.length} songs
                      {playlist.isPublic ? ' · Public' : ' · Private'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                    Open
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState message="No new playlists are available yet." />
          )}
        </section>
      )}
    </div>
  )
}
