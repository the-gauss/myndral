import {
  Heart,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { usePlayer } from '../../hooks/usePlayer'

function fmt(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Player() {
  const {
    currentTrack,
    isPlaying,
    progress,
    volume,
    shuffle,
    repeat,
    togglePlay,
    next,
    prev,
    setProgress,
    setVolume,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer()

  const audioRef = useRef<HTMLAudioElement>(null)

  // Sync playback state with audio element
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack?.audioUrl) return
    audio.src = currentTrack.audioUrl
    audio.load()
    if (isPlaying) audio.play().catch(() => {})
  }, [currentTrack?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.play().catch(() => {})
    else audio.pause()
  }, [isPlaying])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  // Drive progress from audio timeupdate
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    function onTimeUpdate() {
      if (audio && audio.duration) {
        setProgress(audio.currentTime / audio.duration)
      }
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', next)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', next)
    }
  }, [next, setProgress])

  function handleSeek(value: number) {
    const audio = audioRef.current
    if (audio && audio.duration) {
      audio.currentTime = value * audio.duration
    }
    setProgress(value)
  }

  const elapsed = currentTrack ? Math.floor(progress * currentTrack.durationMs) : 0
  const duration = currentTrack?.durationMs ?? 0

  return (
    <>
      {/* Hidden audio engine */}
      <audio ref={audioRef} preload="metadata" />

      <footer className="h-[80px] flex items-center justify-between px-4 border-t border-border bg-background shrink-0 gap-4">
        {/* Left — track info */}
        <div className="flex items-center gap-3 w-[28%] min-w-0">
          {currentTrack ? (
            <>
              <div className="w-12 h-12 rounded bg-border shrink-0 overflow-hidden">
                {currentTrack.album.coverUrl && (
                  <img
                    src={currentTrack.album.coverUrl}
                    alt={currentTrack.album.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0">
                <Link
                  to={`/album/${currentTrack.albumId}`}
                  className="block text-sm font-semibold text-foreground truncate hover:underline"
                >
                  {currentTrack.title}
                </Link>
                <Link
                  to={`/artist/${currentTrack.artistId}`}
                  className="block text-xs text-muted-fg truncate hover:underline"
                >
                  {currentTrack.artist.name}
                </Link>
              </div>
              <button className="text-muted-fg hover:text-accent ml-1 shrink-0 transition-colors">
                <Heart size={15} />
              </button>
            </>
          ) : (
            <p className="text-muted-fg text-sm">Nothing playing</p>
          )}
        </div>

        {/* Centre — controls + seek */}
        <div className="flex flex-col items-center gap-1 w-[44%]">
          <div className="flex items-center gap-5">
            <button
              onClick={toggleShuffle}
              className={`transition-colors ${shuffle ? 'text-accent' : 'text-muted-fg hover:text-foreground'}`}
              aria-label="Shuffle"
            >
              <Shuffle size={16} />
            </button>

            <button onClick={prev} className="text-muted-fg hover:text-foreground transition-colors" aria-label="Previous">
              <SkipBack size={20} />
            </button>

            <button
              onClick={togglePlay}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground text-background hover:scale-105 transition-transform"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying
                ? <Pause size={15} fill="currentColor" />
                : <Play size={15} fill="currentColor" className="ml-0.5" />
              }
            </button>

            <button onClick={next} className="text-muted-fg hover:text-foreground transition-colors" aria-label="Next">
              <SkipForward size={20} />
            </button>

            <button
              onClick={cycleRepeat}
              className={`transition-colors ${repeat !== 'none' ? 'text-accent' : 'text-muted-fg hover:text-foreground'}`}
              aria-label="Repeat"
            >
              {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            </button>
          </div>

          {/* Seek bar */}
          <div className="flex items-center gap-2 w-full">
            <span className="text-xs text-muted-fg w-8 text-right tabular-nums">{fmt(elapsed)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={progress}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="flex-1 h-1 cursor-pointer accent-accent"
            />
            <span className="text-xs text-muted-fg w-8 tabular-nums">{fmt(duration)}</span>
          </div>
        </div>

        {/* Right — volume */}
        <div className="flex items-center gap-2 w-[28%] justify-end">
          <button
            className="text-muted-fg hover:text-foreground transition-colors"
            onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
          >
            {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-20 h-1 cursor-pointer accent-accent"
          />
        </div>
      </footer>
    </>
  )
}
