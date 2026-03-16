import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createAudioPlayer, setAudioModeAsync, useAudioPlayerStatus } from 'expo-audio';
import { resolveMediaUrl } from '@/src/lib/media';
import type { RepeatMode, Track } from '@/src/types/domain';

interface PlayerContextValue {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  isBuffering: boolean;
  progress: number;
  elapsedSeconds: number;
  durationSeconds: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  playTrack: (track: Track, contextQueue?: Track[]) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (progress: number) => Promise<void>;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

const PlayerContext = createContext<PlayerContextValue>({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  isBuffering: false,
  progress: 0,
  elapsedSeconds: 0,
  durationSeconds: 0,
  volume: 0.85,
  shuffle: false,
  repeat: 'none',
  playTrack: () => {},
  togglePlay: () => {},
  next: () => {},
  previous: () => {},
  seekTo: async () => {},
  setVolume: () => {},
  toggleShuffle: () => {},
  cycleRepeat: () => {},
});

export function PlayerProvider({ children }: { children: ReactNode }) {
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  if (!playerRef.current) {
    playerRef.current = createAudioPlayer(null, {
      updateInterval: 250,
      downloadFirst: true,
      preferredForwardBufferDuration: 12,
      keepAudioSessionActive: false,
    });
  }

  const player = playerRef.current;
  const status = useAudioPlayerStatus(player);
  const lastFinishedTrackRef = useRef<string | null>(null);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [volume, setVolumeState] = useState(0.85);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('none');

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });

    return () => {
      player.remove();
    };
  }, [player]);

  useEffect(() => {
    player.volume = volume;
  }, [player, volume]);

  useEffect(() => {
    if (!currentTrack) {
      return;
    }

    const sourceUrl = resolveMediaUrl(currentTrack.audioUrl);
    if (!sourceUrl) {
      return;
    }

    player.replace({
      uri: sourceUrl,
      name: currentTrack.title,
    });
    player.play();
    lastFinishedTrackRef.current = null;
  }, [player, currentTrack?.id, currentTrack?.audioUrl, currentTrack?.title]);

  useEffect(() => {
    if (!status.didJustFinish || !currentTrack) {
      return;
    }

    if (lastFinishedTrackRef.current === currentTrack.id) {
      return;
    }

    lastFinishedTrackRef.current = currentTrack.id;

    if (repeat === 'one') {
      void player.seekTo(0);
      player.play();
      return;
    }

    advanceQueue();
  }, [currentTrack, player, repeat, status.didJustFinish]);

  function selectTrack(nextTrack: Track, nextQueue?: Track[]) {
    if (nextQueue) {
      setQueue(nextQueue);
    }

    setCurrentTrack(nextTrack);
  }

  function playTrack(track: Track, contextQueue?: Track[]) {
    if (currentTrack?.id === track.id) {
      if (status.playing) {
        player.pause();
      } else {
        player.play();
      }
      return;
    }

    selectTrack(track, contextQueue ?? [track]);
  }

  function togglePlay() {
    if (!currentTrack) {
      if (queue[0]) {
        selectTrack(queue[0], queue);
      }
      return;
    }

    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  }

  function advanceQueue() {
    if (!currentTrack || queue.length === 0) {
      return;
    }

    const index = queue.findIndex((track) => track.id === currentTrack.id);
    if (index === -1) {
      return;
    }

    let nextIndex = shuffle ? Math.floor(Math.random() * queue.length) : index + 1;
    if (!shuffle && nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0;
      } else {
        player.pause();
        void player.seekTo(0);
        return;
      }
    }

    setCurrentTrack(queue[nextIndex]);
  }

  function rewindQueue() {
    if (!currentTrack || queue.length === 0) {
      return;
    }

    if (status.currentTime > 5) {
      void player.seekTo(0);
      return;
    }

    const index = queue.findIndex((track) => track.id === currentTrack.id);
    if (index === -1) {
      return;
    }

    const previousIndex = index === 0 ? queue.length - 1 : index - 1;
    setCurrentTrack(queue[previousIndex]);
  }

  async function seekTo(progress: number) {
    if (!status.duration) {
      return;
    }

    const bounded = Math.min(1, Math.max(0, progress));
    await player.seekTo(status.duration * bounded);
  }

  function setVolume(nextVolume: number) {
    const bounded = Math.min(1, Math.max(0, nextVolume));
    setVolumeState(bounded);
  }

  function toggleShuffle() {
    setShuffle((current) => !current);
  }

  function cycleRepeat() {
    setRepeat((current) => {
      if (current === 'none') return 'all';
      if (current === 'all') return 'one';
      return 'none';
    });
  }

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        isPlaying: status.playing,
        isBuffering: status.isBuffering,
        progress: status.duration ? status.currentTime / status.duration : 0,
        elapsedSeconds: status.currentTime,
        durationSeconds:
          status.duration || (currentTrack ? currentTrack.durationMs / 1000 : 0),
        volume,
        shuffle,
        repeat,
        playTrack,
        togglePlay,
        next: advanceQueue,
        previous: rewindQueue,
        seekTo,
        setVolume,
        toggleShuffle,
        cycleRepeat,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}
