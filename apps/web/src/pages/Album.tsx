import { Heart, Play } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import TrackRow from '../components/cards/TrackRow'
import Skeleton from '../components/ui/Skeleton'
import { useAlbum, useAlbumTracks } from '../hooks/useCatalog'
import { usePlayerStore } from '../store/playerStore'

export default function Album() {
  const { id } = useParams<{ id: string }>()
  const { data: album, isLoading: albumLoading } = useAlbum(id!)
  const { data: tracks } = useAlbumTracks(id!)
  const play = usePlayerStore((s) => s.play)

  function playAlbum() {
    if (tracks?.items.length) play(tracks.items[0], tracks.items)
  }

  return (
    <div className="space-y-8 -mt-6 -mx-8">
      {/* Header */}
      <div className="flex items-end gap-6 px-8 pt-8 pb-6 bg-surface/60">
        <div className="w-44 h-44 rounded bg-border shadow-lg shrink-0 overflow-hidden">
          {albumLoading
            ? <Skeleton className="w-full h-full rounded" />
            : album?.coverUrl
              ? <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-border" />
          }
        </div>

        <div className="min-w-0 pb-1">
          {albumLoading ? (
            <>
              <Skeleton className="h-3 w-12 mb-3" />
              <Skeleton className="h-9 w-64 mb-2" />
              <Skeleton className="h-4 w-40" />
            </>
          ) : album ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-fg mb-2">
                {album.albumType}
              </p>
              <h1 className="text-3xl sm:text-4xl font-black text-foreground leading-tight mb-2">
                {album.title}
              </h1>
              <p className="text-sm text-muted-fg">
                <Link to={`/artist/${album.artistId}`} className="font-semibold text-foreground hover:underline">
                  {album.artist.name}
                </Link>
                {' · '}
                {new Date(album.releaseDate).getFullYear()}
                {' · '}
                {album.trackCount} {album.trackCount === 1 ? 'song' : 'songs'}
              </p>
            </>
          ) : null}
        </div>
      </div>

      <div className="px-8 space-y-8">
        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={playAlbum}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-accent text-accent-fg
                       text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Play size={16} fill="currentColor" />
            Play
          </button>
          <button className="p-2 rounded-full text-muted-fg hover:text-foreground transition-colors">
            <Heart size={20} />
          </button>
        </div>

        {/* Track list */}
        {tracks && tracks.items.length > 0 && (
          <section>
            {tracks.items.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i + 1}
                queue={tracks.items}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
