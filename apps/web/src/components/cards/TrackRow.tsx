import type { AxiosError } from 'axios'
import { Download, Heart, ListMusic, MoreHorizontal, Pause, Play, Plus, StepForward } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { usePlayer } from '../../hooks/usePlayer'
import {
  favoriteTrack,
  removeTrackFromLibrary,
  saveTrackToLibrary,
  unfavoriteTrack,
} from '../../services/catalog'
import { useUserStore } from '../../store/userStore'
import type { Track } from '../../types'
import ExportModal from '../ui/ExportModal'
import PlaylistModal from '../ui/PlaylistModal'

interface Props {
  track: Track
  index?: number
  queue?: Track[]
  showAlbum?: boolean
  isFavorite?: boolean
  isInLibrary?: boolean
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function asErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ detail?: unknown }>
  const detail = axiosError?.response?.data?.detail
  return typeof detail === 'string' && detail.trim() ? detail.trim() : fallback
}

export default function TrackRow({
  track,
  index,
  queue,
  showAlbum = false,
  isFavorite = false,
  isInLibrary = false,
}: Props) {
  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue, playNext } = usePlayer()
  const queryClient = useQueryClient()
  const isActive = currentTrack?.id === track.id
  const isPremium = useUserStore((s) => s.isPremium)
  const isAuthenticated = useUserStore((s) => s.isAuthenticated)
  const [exportOpen, setExportOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false)
  const [favorite, setFavorite] = useState(isFavorite)
  const [inLibrary, setInLibrary] = useState(isInLibrary)
  const [actionError, setActionError] = useState<string | null>(null)
  const optionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setFavorite(isFavorite)
  }, [isFavorite])

  useEffect(() => {
    setInLibrary(isInLibrary)
  }, [isInLibrary])

  useEffect(() => {
    if (!optionsOpen) return

    function handleClick(event: MouseEvent) {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setOptionsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [optionsOpen])

  const favoriteMutation = useMutation({
    mutationFn: () => (favorite ? unfavoriteTrack(track.id) : favoriteTrack(track.id)),
    onSuccess: () => {
      setFavorite((current) => !current)
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['collection-state'] })
      queryClient.invalidateQueries({ queryKey: ['favorite-tracks'] })
    },
    onError: (error) => {
      setActionError(asErrorMessage(error, 'Could not update favorites.'))
    },
  })

  const libraryMutation = useMutation({
    mutationFn: () => (inLibrary ? removeTrackFromLibrary(track.id) : saveTrackToLibrary(track.id)),
    onSuccess: () => {
      setInLibrary((current) => !current)
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['collection-state'] })
      queryClient.invalidateQueries({ queryKey: ['library-tracks'] })
    },
    onError: (error) => {
      setActionError(asErrorMessage(error, 'Could not update the library.'))
    },
  })

  function handleClick() {
    if (isActive) togglePlay()
    else playTrack(track, queue)
  }

  return (
    <>
      <div
        onDoubleClick={handleClick}
        className={`group flex items-center gap-4 px-3 py-2 rounded hover:bg-surface transition-colors cursor-default
          ${isActive ? 'text-accent' : 'text-foreground'}`}
      >
        {/* Index / play indicator */}
        <div className="w-5 shrink-0 text-center">
          <span className={`text-sm group-hover:hidden ${isActive ? 'text-accent' : 'text-muted-fg'}`}>
            {isActive && isPlaying ? '▶' : (index ?? '')}
          </span>
          <button
            onClick={handleClick}
            className="hidden group-hover:flex items-center justify-center text-foreground"
            aria-label={isActive && isPlaying ? 'Pause' : 'Play'}
          >
            {isActive && isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isActive ? 'text-accent' : 'text-foreground'}`}>
            {track.title}
          </p>
          <Link
            to={`/artist/${track.artistId}`}
            className="text-xs text-muted-fg truncate hover:underline"
          >
            {track.artist.name}
          </Link>
        </div>

        {/* Album column */}
        {showAlbum && (
          <Link
            to={`/album/${track.albumId}`}
            className="hidden md:block text-xs text-muted-fg truncate w-36 hover:underline"
          >
            {track.album.title}
          </Link>
        )}

        {/* Actions + duration */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(event) => {
              event.stopPropagation()
              favoriteMutation.mutate()
            }}
            className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 ${
              favorite ? 'text-accent opacity-100' : 'text-muted-fg hover:text-foreground'
            }`}
            aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart size={15} fill={favorite ? 'currentColor' : 'none'} />
          </button>
          <span className="text-xs text-muted-fg w-10 text-right tabular-nums">{fmt(track.durationMs)}</span>
          {isAuthenticated && isPremium && (
            <button
              onClick={(e) => { e.stopPropagation(); setExportOpen(true) }}
              className="text-muted-fg hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-1"
              aria-label="Export track"
            >
              <Download size={15} />
            </button>
          )}
          <div ref={optionsRef} className="relative">
            <button
              onClick={(event) => {
                event.stopPropagation()
                setOptionsOpen((current) => !current)
              }}
              className="text-muted-fg hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-1"
              aria-label="More track actions"
            >
              <MoreHorizontal size={15} />
            </button>
            {optionsOpen && (
              <div className="glass-panel-strong absolute right-0 z-40 mt-2 w-56 rounded-2xl p-2">
                <button
                  onClick={() => {
                    playTrack(track, queue)
                    setOptionsOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/5"
                >
                  <Play size={14} />
                  Play now
                </button>
                <button
                  onClick={() => {
                    playNext(track)
                    setOptionsOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/5"
                >
                  <StepForward size={14} />
                  Play next
                </button>
                <button
                  onClick={() => {
                    addToQueue(track)
                    setOptionsOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/5"
                >
                  <ListMusic size={14} />
                  Add to queue
                </button>
                <button
                  onClick={() => {
                    setPlaylistModalOpen(true)
                    setOptionsOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/5"
                >
                  <Plus size={14} />
                  Add to playlist
                </button>
                <button
                  onClick={() => {
                    libraryMutation.mutate()
                    setOptionsOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/5"
                >
                  <Plus size={14} />
                  {inLibrary ? 'Remove from library' : 'Add to library'}
                </button>
                <button
                  onClick={() => {
                    favoriteMutation.mutate()
                    setOptionsOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/5"
                >
                  <Heart size={14} />
                  {favorite ? 'Remove favorite' : 'Add to favorites'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {actionError && (
        <div className="px-3 pt-1 text-xs text-rose-300">
          {actionError}
        </div>
      )}

      {exportOpen && (
        <ExportModal
          target={{ kind: 'track', id: track.id, title: track.title }}
          onClose={() => setExportOpen(false)}
        />
      )}

      <PlaylistModal
        open={playlistModalOpen}
        onClose={() => setPlaylistModalOpen(false)}
        trackIds={[track.id]}
        heading={`Add "${track.title}" to a playlist`}
      />
    </>
  )
}
