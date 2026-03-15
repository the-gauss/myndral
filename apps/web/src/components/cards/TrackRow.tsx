import { Download, Heart, MoreHorizontal, Pause, Play } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlayer } from '../../hooks/usePlayer'
import { useUserStore } from '../../store/userStore'
import type { Track } from '../../types'
import ExportModal from '../ui/ExportModal'

interface Props {
  track: Track
  index?: number
  queue?: Track[]
  showAlbum?: boolean
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function TrackRow({ track, index, queue, showAlbum = false }: Props) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer()
  const isActive = currentTrack?.id === track.id
  const isPremium = useUserStore((s) => s.isPremium)
  const isAuthenticated = useUserStore((s) => s.isAuthenticated)
  const [exportOpen, setExportOpen] = useState(false)

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
          <button className="text-muted-fg hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-1">
            <Heart size={15} />
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
          <button className="text-muted-fg hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-1">
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>

      {exportOpen && (
        <ExportModal
          target={{ kind: 'track', id: track.id, title: track.title }}
          onClose={() => setExportOpen(false)}
        />
      )}
    </>
  )
}
