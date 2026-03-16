import type { AxiosError } from 'axios'
import { Heart, Play, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import AlbumCard, { AlbumCardSkeleton } from '../components/cards/AlbumCard'
import TrackRow from '../components/cards/TrackRow'
import SectionHeader from '../components/ui/SectionHeader'
import Skeleton from '../components/ui/Skeleton'
import { useArtist, useArtistAlbums, useArtistTopTracks, useCollectionState } from '../hooks/useCatalog'
import { resolveMediaUrl } from '../lib/media'
import {
  favoriteArtist,
  removeArtistFromLibrary,
  saveArtistToLibrary,
  unfavoriteArtist,
} from '../services/catalog'
import { usePlayerStore } from '../store/playerStore'

function fmtListeners(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default function Artist() {
  const { id } = useParams<{ id: string }>()
  const { data: artist, isLoading: artistLoading } = useArtist(id!)
  const { data: topTracks } = useArtistTopTracks(id!)
  const { data: albums, isLoading: albumsLoading } = useArtistAlbums(id!)
  const play = usePlayerStore((s) => s.play)
  const heroImageUrl = resolveMediaUrl(artist?.imageUrl)
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)
  const collection = useCollectionState({
    artistIds: artist ? [artist.id] : [],
    trackIds: topTracks?.items.map((track) => track.id) ?? [],
  })
  const favoriteTrackIds = new Set(collection.data?.favorites.trackIds ?? [])
  const libraryTrackIds = new Set(collection.data?.library.trackIds ?? [])
  const isFavorite = Boolean(artist && collection.data?.favorites.artistIds.includes(artist.id))
  const isInLibrary = Boolean(artist && collection.data?.library.artistIds.includes(artist.id))

  function asErrorMessage(error: unknown, fallback: string) {
    const axiosError = error as AxiosError<{ detail?: unknown }>
    const detail = axiosError?.response?.data?.detail
    return typeof detail === 'string' && detail.trim() ? detail.trim() : fallback
  }

  const favoriteMutation = useMutation({
    mutationFn: () => {
      if (!artist) throw new Error('Artist not loaded')
      return isFavorite ? unfavoriteArtist(artist.id) : favoriteArtist(artist.id)
    },
    onSuccess: () => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['artist', id] })
      queryClient.invalidateQueries({ queryKey: ['favorite-artists'] })
      queryClient.invalidateQueries({ queryKey: ['collection-state'] })
    },
    onError: (error) => {
      setActionError(asErrorMessage(error, 'Could not update artist favorites.'))
    },
  })

  const libraryMutation = useMutation({
    mutationFn: () => {
      if (!artist) throw new Error('Artist not loaded')
      return isInLibrary ? removeArtistFromLibrary(artist.id) : saveArtistToLibrary(artist.id)
    },
    onSuccess: () => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['artist', id] })
      queryClient.invalidateQueries({ queryKey: ['library-artists'] })
      queryClient.invalidateQueries({ queryKey: ['collection-state'] })
    },
    onError: (error) => {
      setActionError(asErrorMessage(error, 'Could not update your library.'))
    },
  })

  function playArtist() {
    if (topTracks?.items.length) play(topTracks.items[0], topTracks.items)
  }

  return (
    <div className="space-y-8 -mt-6 -mx-8">
      {/* Hero */}
      <div
        className="relative h-64 flex items-end px-8 pb-6 bg-surface"
        style={heroImageUrl ? { backgroundImage: `url(${heroImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />

        <div className="relative z-10">
          {artistLoading ? (
            <>
              <Skeleton className="h-10 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : artist ? (
            <>
              <h1 className="text-4xl sm:text-5xl font-black text-foreground leading-tight">{artist.name}</h1>
              <p className="text-sm text-muted-fg mt-1">
                {fmtListeners(artist.monthlyListeners)} monthly listeners
              </p>
            </>
          ) : null}
        </div>
      </div>

      <div className="px-8 space-y-8">
        {/* Actions */}
        {artist && (
          <div className="flex items-center gap-3">
            <button
              onClick={playArtist}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-accent text-accent-fg
                         text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Play size={16} fill="currentColor" />
              Play
            </button>
            <button
              className="flex items-center gap-2 px-5 py-2 rounded-full border border-border
                         text-sm font-semibold text-foreground hover:bg-surface transition-colors"
              onClick={() => libraryMutation.mutate()}
            >
              <UserPlus size={15} />
              {isInLibrary ? 'Saved to Library' : 'Add to Library'}
            </button>
            <button
              onClick={() => favoriteMutation.mutate()}
              className={`rounded-full p-2 transition-colors ${
                isFavorite ? 'text-accent' : 'text-muted-fg hover:text-foreground'
              }`}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        )}

        {actionError && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {actionError}
          </div>
        )}

        {/* Top tracks */}
        {topTracks && topTracks.items.length > 0 && (
          <section>
            <SectionHeader title="Popular" />
            {topTracks.items.slice(0, 5).map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i + 1}
                queue={topTracks.items}
                isFavorite={favoriteTrackIds.has(track.id)}
                isInLibrary={libraryTrackIds.has(track.id)}
              />
            ))}
          </section>
        )}

        {/* Discography */}
        {albums && albums.items.length > 0 && (
          <section>
            <SectionHeader title="Discography" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {albumsLoading
                ? Array.from({ length: 4 }).map((_, i) => <AlbumCardSkeleton key={i} />)
                : albums?.items.map((album) => (
                    <AlbumCard key={album.id} album={album} />
                  ))}
            </div>
          </section>
        )}

        {/* Bio */}
        {artist?.bio && (
          <section>
            <SectionHeader title="About" />
            <p className="text-sm text-muted-fg leading-relaxed max-w-prose">{artist.bio}</p>
          </section>
        )}
      </div>
    </div>
  )
}
