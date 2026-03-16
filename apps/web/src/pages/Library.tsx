import { Disc3, ListMusic, Mic2, Music, Plus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import TrackRow from '../components/cards/TrackRow'
import PlaylistModal from '../components/ui/PlaylistModal'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import {
  useCollectionState,
  useFavoriteAlbums,
  useFavoriteArtists,
  useFavoriteTracks,
  useLibraryAlbums,
  useLibraryArtists,
  useLibraryPlaylists,
  useLibraryTracks,
} from '../hooks/useCatalog'
import { resolveMediaUrl } from '../lib/media'

type LibraryView = 'saved' | 'favorites'

interface SectionItemProps {
  to: string
  title: string
  subtitle: string
  imageUrl?: string
  Icon: typeof Music
}

function SectionItem({ to, title, subtitle, imageUrl, Icon }: SectionItemProps) {
  const coverUrl = resolveMediaUrl(imageUrl)

  return (
    <Link
      to={to}
      className="surface-hover flex items-center gap-4 rounded-2xl border border-border/40 bg-background/20 px-4 py-3"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface/70">
        {coverUrl ? (
          <img src={coverUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <Icon size={18} className="text-muted-fg" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-fg">{subtitle}</p>
      </div>
    </Link>
  )
}

function SectionShell({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: ReactNode
}) {
  return (
    <section className="glass-panel rounded-[28px] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
          {count} {count === 1 ? 'item' : 'items'}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

export default function Library() {
  const [view, setView] = useState<LibraryView>('saved')
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false)
  const libraryTracks = useLibraryTracks()
  const libraryAlbums = useLibraryAlbums()
  const libraryArtists = useLibraryArtists()
  const libraryPlaylists = useLibraryPlaylists()
  const favoriteTracks = useFavoriteTracks()
  const favoriteAlbums = useFavoriteAlbums()
  const favoriteArtists = useFavoriteArtists()

  const savedTrackIds = libraryTracks.data?.items.map((track) => track.id) ?? []
  const favoriteTrackIdsRaw = favoriteTracks.data?.items.map((track) => track.id) ?? []
  const collection = useCollectionState({
    trackIds: Array.from(new Set([...savedTrackIds, ...favoriteTrackIdsRaw])),
  })

  const favoriteTrackIds = useMemo(
    () => new Set(collection.data?.favorites.trackIds ?? favoriteTrackIdsRaw),
    [collection.data?.favorites.trackIds, favoriteTrackIdsRaw],
  )
  const libraryTrackIds = useMemo(
    () => new Set(collection.data?.library.trackIds ?? savedTrackIds),
    [collection.data?.library.trackIds, savedTrackIds],
  )

  const savedLoading =
    libraryTracks.isLoading || libraryAlbums.isLoading || libraryArtists.isLoading || libraryPlaylists.isLoading
  const favoritesLoading =
    favoriteTracks.isLoading || favoriteAlbums.isLoading || favoriteArtists.isLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground">Your Library</h1>
          <p className="mt-2 text-sm text-muted-fg">
            Save artists, albums, songs, and playlists for return listening, and keep favorites in a dedicated lane.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="glass-pill flex rounded-full p-1">
            {(['saved', 'favorites'] as LibraryView[]).map((option) => (
              <button
                key={option}
                onClick={() => setView(option)}
                className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                  view === option
                    ? 'bg-accent text-accent-fg'
                    : 'text-muted-fg hover:bg-foreground/5 hover:text-foreground'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPlaylistModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg"
          >
            <Plus size={15} />
            New playlist
          </button>
        </div>
      </div>

      {view === 'saved' ? (
        savedLoading ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="glass-panel rounded-[28px] p-5">
                <Skeleton className="h-5 w-40" />
                <div className="mt-4 space-y-2">
                  {Array.from({ length: 3 }).map((__, itemIndex) => (
                    <div key={itemIndex} className="flex items-center gap-4 py-2">
                      <Skeleton className="h-14 w-14 rounded-2xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionShell title="Artists" count={libraryArtists.data?.items.length ?? 0}>
              {libraryArtists.data?.items.length ? (
                libraryArtists.data.items.map((artist) => (
                  <SectionItem
                    key={artist.id}
                    to={`/artist/${artist.id}`}
                    title={artist.name}
                    subtitle="Saved artist"
                    imageUrl={artist.imageUrl}
                    Icon={Mic2}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-fg">No saved artists yet.</p>
              )}
            </SectionShell>

            <SectionShell title="Albums" count={libraryAlbums.data?.items.length ?? 0}>
              {libraryAlbums.data?.items.length ? (
                libraryAlbums.data.items.map((album) => (
                  <SectionItem
                    key={album.id}
                    to={`/album/${album.id}`}
                    title={album.title}
                    subtitle={`${album.artist.name} · ${album.trackCount} tracks`}
                    imageUrl={album.coverUrl}
                    Icon={Disc3}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-fg">No saved albums yet.</p>
              )}
            </SectionShell>

            <SectionShell title="Playlists" count={libraryPlaylists.data?.items.length ?? 0}>
              {libraryPlaylists.data?.items.length ? (
                libraryPlaylists.data.items.map((playlist) => (
                  <SectionItem
                    key={playlist.id}
                    to={`/playlist/${playlist.id}`}
                    title={playlist.name}
                    subtitle={`${playlist.trackCount ?? playlist.tracks.length} songs${playlist.isPublic ? ' · Public' : ' · Private'}`}
                    imageUrl={playlist.coverUrl}
                    Icon={ListMusic}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-fg">No saved playlists yet.</p>
              )}
            </SectionShell>

            <SectionShell title="Songs" count={libraryTracks.data?.items.length ?? 0}>
              {libraryTracks.data?.items.length ? (
                libraryTracks.data.items.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={index + 1}
                    queue={libraryTracks.data?.items}
                    showAlbum
                    isFavorite={favoriteTrackIds.has(track.id)}
                    isInLibrary={libraryTrackIds.has(track.id)}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-fg">No saved songs yet.</p>
              )}
            </SectionShell>
          </div>
        )
      ) : favoritesLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="glass-panel rounded-[28px] p-5">
              <Skeleton className="h-5 w-40" />
              <div className="mt-4 space-y-2">
                {Array.from({ length: 3 }).map((__, itemIndex) => (
                  <div key={itemIndex} className="flex items-center gap-4 py-2">
                    <Skeleton className="h-14 w-14 rounded-2xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionShell title="Favorite Artists" count={favoriteArtists.data?.items.length ?? 0}>
            {favoriteArtists.data?.items.length ? (
              favoriteArtists.data.items.map((artist) => (
                <SectionItem
                  key={artist.id}
                  to={`/artist/${artist.id}`}
                  title={artist.name}
                  subtitle="Liked artist"
                  imageUrl={artist.imageUrl}
                  Icon={Mic2}
                />
              ))
            ) : (
              <p className="text-sm text-muted-fg">No favorite artists yet.</p>
            )}
          </SectionShell>

          <SectionShell title="Favorite Albums" count={favoriteAlbums.data?.items.length ?? 0}>
            {favoriteAlbums.data?.items.length ? (
              favoriteAlbums.data.items.map((album) => (
                <SectionItem
                  key={album.id}
                  to={`/album/${album.id}`}
                  title={album.title}
                  subtitle={`${album.artist.name} · liked album`}
                  imageUrl={album.coverUrl}
                  Icon={Disc3}
                />
              ))
            ) : (
              <p className="text-sm text-muted-fg">No favorite albums yet.</p>
            )}
          </SectionShell>

          <SectionShell title="Favorite Songs" count={favoriteTracks.data?.items.length ?? 0}>
            {favoriteTracks.data?.items.length ? (
              favoriteTracks.data.items.map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={index + 1}
                  queue={favoriteTracks.data?.items}
                  showAlbum
                  isFavorite
                  isInLibrary={libraryTrackIds.has(track.id)}
                />
              ))
            ) : (
              <p className="text-sm text-muted-fg">No favorite songs yet.</p>
            )}
          </SectionShell>
        </div>
      )}

      {!savedLoading &&
        !favoritesLoading &&
        view === 'saved' &&
        !libraryArtists.data?.items.length &&
        !libraryAlbums.data?.items.length &&
        !libraryPlaylists.data?.items.length &&
        !libraryTracks.data?.items.length && (
          <EmptyState message="Your library is empty. Save something from any album, artist, song, or playlist." />
        )}

      {!savedLoading &&
        !favoritesLoading &&
        view === 'favorites' &&
        !favoriteArtists.data?.items.length &&
        !favoriteAlbums.data?.items.length &&
        !favoriteTracks.data?.items.length && (
          <EmptyState message="Your favorites are empty. Tap the heart on songs, artists, or albums to build this space." />
        )}

      <PlaylistModal
        open={playlistModalOpen}
        onClose={() => setPlaylistModalOpen(false)}
        heading="Create a new playlist"
      />
    </div>
  )
}
