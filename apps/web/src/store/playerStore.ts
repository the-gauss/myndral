import { create } from 'zustand'
import type { Track } from '../types'

type RepeatMode = 'none' | 'one' | 'all'

interface PlayerStore {
  currentTrack: Track | null
  queue: Track[]
  isPlaying: boolean
  progress: number     // 0–1
  volume: number       // 0–1
  shuffle: boolean
  repeat: RepeatMode

  play: (track: Track, queue?: Track[]) => void
  pause: () => void
  resume: () => void
  next: () => void
  prev: () => void
  setQueue: (tracks: Track[]) => void
  setProgress: (progress: number) => void
  setVolume: (volume: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  progress: 0,
  volume: 0.8,
  shuffle: false,
  repeat: 'none',

  play: (track, queue) =>
    set({ currentTrack: track, isPlaying: true, progress: 0, ...(queue ? { queue } : {}) }),

  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),

  next: () => {
    const { queue, currentTrack, shuffle, repeat } = get()
    if (!queue.length) return

    if (repeat === 'one') {
      set({ progress: 0, isPlaying: true })
      return
    }

    const idx = queue.findIndex((t) => t.id === currentTrack?.id)
    let nextIdx: number

    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length)
    } else {
      nextIdx = idx + 1
      if (nextIdx >= queue.length) {
        if (repeat === 'all') nextIdx = 0
        else { set({ isPlaying: false, progress: 0 }); return }
      }
    }

    set({ currentTrack: queue[nextIdx], progress: 0, isPlaying: true })
  },

  prev: () => {
    const { queue, currentTrack, progress } = get()
    if (progress > 0.05) { set({ progress: 0 }); return }
    if (!queue.length) return

    const idx = queue.findIndex((t) => t.id === currentTrack?.id)
    const prevIdx = (idx - 1 + queue.length) % queue.length
    set({ currentTrack: queue[prevIdx], progress: 0, isPlaying: true })
  },

  setQueue: (tracks) => set({ queue: tracks }),
  setProgress: (progress) => set({ progress }),
  setVolume: (volume) => set({ volume }),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => ({ repeat: s.repeat === 'none' ? 'all' : s.repeat === 'all' ? 'one' : 'none' })),
}))
