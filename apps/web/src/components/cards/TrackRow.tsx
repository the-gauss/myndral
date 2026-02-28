import { Heart, MoreHorizontal } from 'lucide-react'
import { usePlayer } from '../../hooks/usePlayer'
import type { Track } from '../../types'

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

  function handleClick() {
    if (isActive) togglePlay()
    else playTrack(track, queue)
  }

  return (
    <div
      onDoubleClick={handleClick}
      className={`group flex items-center gap-4 px-4 py-2 rounded hover:bg-white/10 cursor-pointer transition-colors
        ${isActive ? 'text-accent' : 'text-white'}`}
    >
      {/* Index / play indicator */}
      <div className="w-4 text-center text-sm text-muted group-hover:hidden">
        {isActive && isPlaying ? '▶' : index ?? ''}
      </div>
      <button
        onClick={handleClick}
        className="w-4 text-center text-sm hidden group-hover:block text-white"
      >
        {isActive && isPlaying ? '⏸' : '▶'}
      </button>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-accent' : 'text-white'}`}>
          {track.title}
        </p>
        <p className="text-xs text-muted truncate">{track.artist.name}</p>
      </div>

      {/* Album */}
      {showAlbum && (
        <p className="hidden md:block text-xs text-muted truncate w-36">{track.album.title}</p>
      )}

      {/* Actions + duration */}
      <div className="flex items-center gap-3 shrink-0">
        <button className="text-muted hover:text-white opacity-0 group-hover:opacity-100 transition">
          <Heart size={16} />
        </button>
        <span className="text-xs text-muted w-10 text-right">{fmt(track.durationMs)}</span>
        <button className="text-muted hover:text-white opacity-0 group-hover:opacity-100 transition">
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  )
}
