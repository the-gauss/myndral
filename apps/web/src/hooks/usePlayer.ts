import { usePlayerStore } from '../store/playerStore'
import type { Track } from '../types'

/** Convenience hook that co-locates player actions used in most components. */
export function usePlayer() {
  const store = usePlayerStore()

  function playTrack(track: Track, contextQueue?: Track[]) {
    store.play(track, contextQueue ?? [track])
  }

  function togglePlay() {
    if (store.isPlaying) store.pause()
    else store.resume()
  }

  return {
    currentTrack: store.currentTrack,
    isPlaying: store.isPlaying,
    progress: store.progress,
    volume: store.volume,
    shuffle: store.shuffle,
    repeat: store.repeat,
    playTrack,
    togglePlay,
    next: store.next,
    prev: store.prev,
    setVolume: store.setVolume,
    setProgress: store.setProgress,
    toggleShuffle: store.toggleShuffle,
    cycleRepeat: store.cycleRepeat,
  }
}
