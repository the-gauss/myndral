import type { AxiosError } from 'axios'
import { Download, Heart, Play, Plus } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import TrackRow from '../components/cards/TrackRow'
import ExportModal from '../components/ui/ExportModal'
import Skeleton from '../components/ui/Skeleton'
import { useAlbum, useAlbumTracks, useCollectionState } from '../hooks/useCatalog'
import { resolveMediaUrl } from '../lib/media'
import {
  favoriteAlbum,
  removeAlbumFromLibrary,
  saveAlbumToLibrary,
  unfavoriteAlbum,
} from '../services/catalog'
import { usePlayerStore } from '../store/playerStore'
import { useUserStore } from '../store/userStore'

function asErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ detail?: unknown }>
  const detail = axiosError?.response?.data?.detail
  return typeof detail === 'string' && detail.trim() ? detail.trim() : fallback
}

export default function Album() {
  const { id } = useParams<{ id: string }>()
  const { data: album, isLoading: albumLoading } = useAlbum(id!)
  const { data: tracks } = useAlbumTracks(id!)
  const play = usePlayerStore((s) => s.play)
  const isPremium = useUserStore((s) => s.isPremium)
  const isAuthenticated = useUserStore((s) => s.isAuthenticated)
  const [exportOpen, setExportOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const coverUrl = resolveMediaUrl(album?.coverUrl)
  const trackIds = tracks?.items.map((track) => track.id) ?? []
  const collection = useCollectionState({
    albumIds: album ? [album.id] : [],
    trackIds,
  })
  const isFavorite = Boolean(album && collection.data?.favorites.albumIds.includes(album.id))
  const isInLibrary = Boolean(album && collection.data?.library.albumIds.includes(album.id))
  const favoriteTrackIds = new Set(collection.data?.favorites.trackIds ?? [])
  const libraryTrackIds = new Set(collection.data?.library.trackIds ?? [])

  function playAlbum() {
    if (tracks?.items.length) play(tracks.items[0], tracks.items)
  }

  const favoriteMutation = useMutation({
    mutationFn: () => {
      if (!album) throw new Error('Album not loaded')
      return isFavorite ? unfavoriteAlbum(album.id) : favoriteAlbum(album.id)
    },
    onSuccess: () => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['album', id] })
      queryClient.invalidateQueries({ queryKey: ['favorite-albums'] })
      queryClient.invalidateQueries({ queryKey: ['collection-state'] })
    },
    onError: (error) => setActionError(asErrorMessage(error, 'Could not update album favorites.')),
  })

  const libraryMutation = useMutation({
    mutationFn: () => {
      if (!album) throw new Error('Album not loaded')
      return isInLibrary ? removeAlbumFromLibrary(album.id) : saveAlbumToLibrary(album.id)
    },
    onSuccess: () => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['album', id] })
      queryClient.invalidateQueries({ queryKey: ['library-albums'] })
      queryClient.invalidateQueries({ queryKey: ['collection-state'] })
    },
    onError: (error) => setActionError(asErrorMessage(error, 'Could not update your library.')),
  })

  return (
    <div className="space-y-8 -mt-6 -mx-8">
      {/* Header */}
      <div className="flex items-end gap-6 px-8 pt-8 pb-6 bg-surface/60">
        <div className="w-44 h-44 rounded bg-border shadow-lg shrink-0 overflow-hidden">
          {albumLoading
            ? <Skeleton className="w-full h-full rounded" />
            : coverUrl
              ? <img src={coverUrl} alt={album?.title ?? 'Album cover'} className="w-full h-full object-cover" />
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
        {album && (
          <div className="flex items-center gap-3">
            <button
              onClick={playAlbum}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-accent text-accent-fg
                         text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Play size={16} fill="currentColor" />
              Play
            </button>
            <button
              onClick={() => favoriteMutation.mutate()}
              className={`rounded-full p-2 transition-colors ${
                isFavorite ? 'text-accent' : 'text-muted-fg hover:text-foreground'
              }`}
            >
              <Heart
                size={20}
                fill={isFavorite ? 'currentColor' : 'none'}
              />
            </button>
            <button
              onClick={() => libraryMutation.mutate()}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-fg hover:border-foreground/30 hover:text-foreground"
            >
              <Plus size={15} />
              {isInLibrary ? 'Saved to Library' : 'Add to Library'}
            </button>
            {isAuthenticated && isPremium && (
              <button
                onClick={() => setExportOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm text-muted-fg hover:text-foreground hover:border-foreground/40 transition-colors"
              >
                <Download size={14} />
                Export Album
              </button>
            )}
          </div>
        )}

        {actionError && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {actionError}
          </div>
        )}

        {/* Track list */}
        {tracks && tracks.items.length > 0 && (
          <section>
            {tracks.items.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i + 1}
                queue={tracks.items}
                isFavorite={favoriteTrackIds.has(track.id)}
                isInLibrary={libraryTrackIds.has(track.id)}
              />
            ))}
          </section>
        )}
      </div>

      {exportOpen && album && (
        <ExportModal
          target={{ kind: 'album', id: album.id, title: album.title }}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  )
}
