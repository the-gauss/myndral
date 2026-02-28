import {
  Heart,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { usePlayer } from '../../hooks/usePlayer'

/** Formats milliseconds → m:ss */
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

  const elapsed = currentTrack ? Math.floor(progress * currentTrack.durationMs) : 0
  const duration = currentTrack?.durationMs ?? 0

  return (
    <footer className="h-[90px] flex items-center justify-between px-4 border-t border-elevated bg-surface shrink-0">
      {/* Left — track info */}
      <div className="flex items-center gap-3 w-[30%]">
        {currentTrack ? (
          <>
            <div className="w-14 h-14 rounded bg-elevated shrink-0 overflow-hidden">
              {currentTrack.album.coverUrl && (
                <img
                  src={currentTrack.album.coverUrl}
                  alt={currentTrack.album.title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="truncate">
              <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
              <p className="text-xs text-muted truncate">{currentTrack.artist.name}</p>
            </div>
            <button className="text-muted hover:text-accent ml-2 shrink-0">
              <Heart size={16} />
            </button>
          </>
        ) : (
          <p className="text-muted text-sm">Nothing playing</p>
        )}
      </div>

      {/* Centre — controls + seek */}
      <div className="flex flex-col items-center gap-1 w-[40%]">
        <div className="flex items-center gap-5">
          <button
            onClick={toggleShuffle}
            className={`transition-colors ${shuffle ? 'text-accent' : 'text-muted hover:text-white'}`}
          >
            <Shuffle size={18} />
          </button>

          <button onClick={prev} className="text-muted hover:text-white transition-colors">
            <SkipBack size={22} />
          </button>

          <button
            onClick={togglePlay}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform"
          >
            {isPlaying ? (
              <span className="w-3 h-3 flex gap-[3px]">
                <span className="flex-1 bg-black rounded-sm" />
                <span className="flex-1 bg-black rounded-sm" />
              </span>
            ) : (
              <span className="ml-0.5 border-y-[6px] border-y-transparent border-l-[10px] border-l-black" />
            )}
          </button>

          <button onClick={next} className="text-muted hover:text-white transition-colors">
            <SkipForward size={22} />
          </button>

          <button
            onClick={cycleRepeat}
            className={`transition-colors ${repeat !== 'none' ? 'text-accent' : 'text-muted hover:text-white'}`}
          >
            {repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
        </div>

        {/* Seek bar */}
        <div className="flex items-center gap-2 w-full">
          <span className="text-xs text-muted w-10 text-right">{fmt(elapsed)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="flex-1 accent-accent h-1 cursor-pointer"
          />
          <span className="text-xs text-muted w-10">{fmt(duration)}</span>
        </div>
      </div>

      {/* Right — volume */}
      <div className="flex items-center gap-2 w-[30%] justify-end">
        <button className="text-muted hover:text-white transition-colors" onClick={() => setVolume(volume > 0 ? 0 : 0.8)}>
          {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-24 accent-accent h-1 cursor-pointer"
        />
      </div>
    </footer>
  )
}
