import { Music, Play } from 'lucide-react'
import { useParams } from 'react-router-dom'
import TrackRow from '../components/cards/TrackRow'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import { usePlaylist } from '../hooks/useCatalog'
import { usePlayerStore } from '../store/playerStore'

export default function Playlist() {
  const { id } = useParams<{ id: string }>()
  const { data: playlist, isLoading } = usePlaylist(id!)
  const play = usePlayerStore((s) => s.play)

  function playPlaylist() {
    if (playlist?.tracks.length) play(playlist.tracks[0], playlist.tracks)
  }

  return (
    <div className="space-y-8 -mt-6 -mx-8">
      {/* Header */}
      <div className="flex items-end gap-6 px-8 pt-8 pb-6 bg-surface/60">
        <div className="w-44 h-44 rounded bg-border shadow-lg shrink-0 overflow-hidden">
          {isLoading
            ? <Skeleton className="w-full h-full rounded" />
            : playlist?.coverUrl
              ? <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center">
                  <Music size={32} className="text-muted-fg" />
                </div>
          }
        </div>

        <div className="min-w-0 pb-1">
          {isLoading ? (
            <>
              <Skeleton className="h-3 w-16 mb-3" />
              <Skeleton className="h-9 w-56 mb-2" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : playlist ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-fg mb-2">
                {playlist.isAiCurated ? 'AI Curated Playlist' : 'Playlist'}
              </p>
              <h1 className="text-3xl sm:text-4xl font-black text-foreground leading-tight mb-2">
                {playlist.name}
              </h1>
              {playlist.description && (
                <p className="text-sm text-muted-fg mb-1">{playlist.description}</p>
              )}
              <p className="text-sm text-muted-fg">
                {playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}
              </p>
            </>
          ) : null}
        </div>
      </div>

      <div className="px-8 space-y-6">
        {/* Actions */}
        {playlist && playlist.tracks.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={playPlaylist}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-accent text-accent-fg
                         text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Play size={16} fill="currentColor" />
              Play
            </button>
          </div>
        )}

        {/* Track list */}
        {playlist && playlist.tracks.length > 0 ? (
          <section>
            {playlist.tracks.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i + 1}
                queue={playlist.tracks}
                showAlbum
              />
            ))}
          </section>
        ) : !isLoading ? (
          <EmptyState message="This playlist has no tracks yet." />
        ) : null}
      </div>
    </div>
  )
}
