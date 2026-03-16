import type { AxiosError } from 'axios'
import { Music, Play, Plus } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import TrackRow from '../components/cards/TrackRow'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import { useCollectionState, usePlaylist } from '../hooks/useCatalog'
import { resolveMediaUrl } from '../lib/media'
import { removePlaylistFromLibrary, savePlaylistToLibrary } from '../services/catalog'
import { usePlayerStore } from '../store/playerStore'

function asErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ detail?: unknown }>
  const detail = axiosError?.response?.data?.detail
  return typeof detail === 'string' && detail.trim() ? detail.trim() : fallback
}

export default function Playlist() {
  const { id } = useParams<{ id: string }>()
  const { data: playlist, isLoading } = usePlaylist(id!)
  const play = usePlayerStore((s) => s.play)
  const coverUrl = resolveMediaUrl(playlist?.coverUrl)
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)
  const collection = useCollectionState({
    playlistIds: playlist ? [playlist.id] : [],
    trackIds: playlist?.tracks.map((track) => track.id) ?? [],
  })
  const isInLibrary = Boolean(playlist && collection.data?.library.playlistIds.includes(playlist.id))
  const favoriteTrackIds = new Set(collection.data?.favorites.trackIds ?? [])
  const libraryTrackIds = new Set(collection.data?.library.trackIds ?? [])

  function playPlaylist() {
    if (playlist?.tracks.length) play(playlist.tracks[0], playlist.tracks)
  }

  const libraryMutation = useMutation({
    mutationFn: () => {
      if (!playlist) throw new Error('Playlist not loaded')
      return isInLibrary ? removePlaylistFromLibrary(playlist.id) : savePlaylistToLibrary(playlist.id)
    },
    onSuccess: () => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['playlist', id] })
      queryClient.invalidateQueries({ queryKey: ['library-playlists'] })
      queryClient.invalidateQueries({ queryKey: ['user-playlists'] })
      queryClient.invalidateQueries({ queryKey: ['editable-user-playlists'] })
      queryClient.invalidateQueries({ queryKey: ['collection-state'] })
    },
    onError: (error) => setActionError(asErrorMessage(error, 'Could not update the playlist library state.')),
  })

  return (
    <div className="space-y-8 -mt-6 -mx-8">
      {/* Header */}
      <div className="flex items-end gap-6 px-8 pt-8 pb-6 bg-surface/60">
        <div className="w-44 h-44 rounded bg-border shadow-lg shrink-0 overflow-hidden">
          {isLoading
            ? <Skeleton className="w-full h-full rounded" />
            : coverUrl
              ? <img src={coverUrl} alt={playlist?.name ?? 'Playlist cover'} className="w-full h-full object-cover" />
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
                {playlist.ownerDisplayName ? `${playlist.ownerDisplayName} · ` : ''}
                {playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}
                {playlist.isPublic ? ' · Public' : ' · Private'}
              </p>
            </>
          ) : null}
        </div>
      </div>

      <div className="px-8 space-y-6">
        {/* Actions */}
        {playlist && (
          <div className="flex items-center gap-3">
            {playlist.tracks.length > 0 && (
              <button
                onClick={playPlaylist}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-accent text-accent-fg
                           text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <Play size={16} fill="currentColor" />
                Play
              </button>
            )}
            <button
              onClick={() => libraryMutation.mutate()}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-fg hover:border-foreground/30 hover:text-foreground"
            >
              <Plus size={15} />
              {isInLibrary ? 'Saved to Library' : 'Add to Library'}
            </button>
          </div>
        )}

        {actionError && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {actionError}
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
                isFavorite={favoriteTrackIds.has(track.id)}
                isInLibrary={libraryTrackIds.has(track.id)}
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
