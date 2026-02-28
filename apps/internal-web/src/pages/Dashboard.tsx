import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormEvent, useMemo, useState } from 'react'
import {
  createAlbum,
  createArtist,
  createTrack,
  listAlbums,
  listArtists,
  listGenres,
  listTracks,
  updateAlbum,
  updateArtist,
  updateTrack,
} from '../services/internal'
import { useAuthStore } from '../store/authStore'
import type { AlbumType, ContentStatus, TrackAudioFile } from '../types'

type Tab = 'artists' | 'albums' | 'tracks'

const statusOptions: ContentStatus[] = ['draft', 'review', 'published', 'archived']
const albumTypeOptions: AlbumType[] = ['album', 'single', 'ep', 'compilation']

function parseCsv(raw: string): string[] {
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function parseNumber(raw: string): number | undefined {
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

export default function Dashboard() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const clearSession = useAuthStore((s) => s.clearSession)

  const [tab, setTab] = useState<Tab>('artists')

  const genres = useQuery({ queryKey: ['genres'], queryFn: listGenres })
  const artists = useQuery({ queryKey: ['artists'], queryFn: () => listArtists({ limit: 100 }) })
  const albums = useQuery({ queryKey: ['albums'], queryFn: () => listAlbums({ limit: 100 }) })
  const tracks = useQuery({ queryKey: ['tracks'], queryFn: () => listTracks({ limit: 100 }) })

  const [artistName, setArtistName] = useState('')
  const [artistSlug, setArtistSlug] = useState('')
  const [artistBio, setArtistBio] = useState('')
  const [artistStyles, setArtistStyles] = useState('')
  const [artistStatus, setArtistStatus] = useState<ContentStatus>('draft')
  const [artistGenreIds, setArtistGenreIds] = useState<string[]>([])

  const [albumTitle, setAlbumTitle] = useState('')
  const [albumSlug, setAlbumSlug] = useState('')
  const [albumArtistId, setAlbumArtistId] = useState('')
  const [albumDescription, setAlbumDescription] = useState('')
  const [albumReleaseDate, setAlbumReleaseDate] = useState('')
  const [albumType, setAlbumType] = useState<AlbumType>('album')
  const [albumStatus, setAlbumStatus] = useState<ContentStatus>('draft')
  const [albumGenreIds, setAlbumGenreIds] = useState<string[]>([])

  const [trackTitle, setTrackTitle] = useState('')
  const [trackAlbumId, setTrackAlbumId] = useState('')
  const [trackArtistId, setTrackArtistId] = useState('')
  const [trackNumber, setTrackNumber] = useState('1')
  const [discNumber, setDiscNumber] = useState('1')
  const [durationMs, setDurationMs] = useState('180000')
  const [trackStatus, setTrackStatus] = useState<ContentStatus>('draft')
  const [trackExplicit, setTrackExplicit] = useState(false)
  const [trackGenreIds, setTrackGenreIds] = useState<string[]>([])
  const [audioPath, setAudioPath] = useState('')
  const [audioQuality, setAudioQuality] = useState<TrackAudioFile['quality']>('high_320')
  const [audioFormat, setAudioFormat] = useState<TrackAudioFile['format']>('mp3')

  const [artistStatusDraft, setArtistStatusDraft] = useState<Record<string, ContentStatus>>({})
  const [albumStatusDraft, setAlbumStatusDraft] = useState<Record<string, ContentStatus>>({})
  const [trackStatusDraft, setTrackStatusDraft] = useState<Record<string, ContentStatus>>({})

  const activeArtistOptions = artists.data?.items ?? []
  const activeAlbumOptions = albums.data?.items ?? []

  const createArtistMutation = useMutation({
    mutationFn: createArtist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artists'] })
      setArtistName('')
      setArtistSlug('')
      setArtistBio('')
      setArtistStyles('')
      setArtistGenreIds([])
      setArtistStatus('draft')
    },
  })

  const createAlbumMutation = useMutation({
    mutationFn: createAlbum,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      setAlbumTitle('')
      setAlbumSlug('')
      setAlbumDescription('')
      setAlbumReleaseDate('')
      setAlbumGenreIds([])
      setAlbumStatus('draft')
    },
  })

  const createTrackMutation = useMutation({
    mutationFn: createTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] })
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      setTrackTitle('')
      setTrackNumber('1')
      setDiscNumber('1')
      setDurationMs('180000')
      setTrackExplicit(false)
      setTrackStatus('draft')
      setTrackGenreIds([])
      setAudioPath('')
    },
  })

  const updateArtistMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) => updateArtist(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['artists'] }),
  })

  const updateAlbumMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) => updateAlbum(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['albums'] }),
  })

  const updateTrackMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) => updateTrack(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tracks'] }),
  })

  function onArtistSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createArtistMutation.mutate({
      name: artistName,
      slug: artistSlug || undefined,
      bio: artistBio || undefined,
      status: artistStatus,
      styleTags: parseCsv(artistStyles),
      genreIds: artistGenreIds,
    })
  }

  function onAlbumSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!albumArtistId) return
    createAlbumMutation.mutate({
      title: albumTitle,
      slug: albumSlug || undefined,
      artistId: albumArtistId,
      description: albumDescription || undefined,
      releaseDate: albumReleaseDate || undefined,
      albumType,
      status: albumStatus,
      genreIds: albumGenreIds,
    })
  }

  function onTrackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trackAlbumId) return

    const audioFiles = audioPath
      ? [{
          quality: audioQuality,
          format: audioFormat,
          storageUrl: audioPath,
          channels: 2,
          durationMs: parseNumber(durationMs),
        }]
      : []

    createTrackMutation.mutate({
      title: trackTitle,
      albumId: trackAlbumId,
      primaryArtistId: trackArtistId || undefined,
      trackNumber: Number(trackNumber) || 1,
      discNumber: Number(discNumber) || 1,
      durationMs: Number(durationMs) || 0,
      explicit: trackExplicit,
      status: trackStatus,
      genreIds: trackGenreIds,
      audioFiles,
    })
  }

  const loading = genres.isLoading || artists.isLoading || albums.isLoading || tracks.isLoading

  const toolbarTitle = useMemo(() => {
    if (tab === 'artists') return 'Artist Management'
    if (tab === 'albums') return 'Album Management'
    return 'Track Management'
  }, [tab])

  return (
    <div className="h-screen grid grid-cols-[220px_1fr] bg-background text-foreground">
      <aside className="border-r border-border p-4 bg-surface/70">
        <h1 className="text-lg font-bold tracking-wide">Internal Studio</h1>
        <p className="text-xs text-muted-fg mt-1">Catalog Operations</p>

        <nav className="mt-8 space-y-1">
          <button
            onClick={() => setTab('artists')}
            className={`w-full rounded-md px-3 py-2 text-left text-sm ${tab === 'artists' ? 'bg-accent text-accent-fg' : 'hover:bg-surface'}`}
          >
            Artists
          </button>
          <button
            onClick={() => setTab('albums')}
            className={`w-full rounded-md px-3 py-2 text-left text-sm ${tab === 'albums' ? 'bg-accent text-accent-fg' : 'hover:bg-surface'}`}
          >
            Albums
          </button>
          <button
            onClick={() => setTab('tracks')}
            className={`w-full rounded-md px-3 py-2 text-left text-sm ${tab === 'tracks' ? 'bg-accent text-accent-fg' : 'hover:bg-surface'}`}
          >
            Tracks
          </button>
        </nav>

        <div className="mt-auto pt-12">
          <p className="text-xs text-muted-fg">Signed in as</p>
          <p className="text-sm font-medium mt-1">{user?.displayName}</p>
          <p className="text-xs text-muted-fg">{user?.role}</p>
          <button
            onClick={clearSession}
            className="mt-3 text-xs rounded-md border border-border px-2.5 py-1.5 hover:bg-surface"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="overflow-y-auto p-6 space-y-6">
        <header>
          <h2 className="text-2xl font-semibold">{toolbarTitle}</h2>
          <p className="text-sm text-muted-fg">
            Add and manage catalog entries. Audio files can point to local `data/...` paths.
          </p>
        </header>

        {loading && <p className="text-sm text-muted-fg">Loading catalog metadata...</p>}

        {tab === 'artists' && (
          <section className="space-y-4">
            <form onSubmit={onArtistSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-surface/40">
              <label className="text-sm">
                Name
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={artistName} onChange={(e) => setArtistName(e.target.value)} required />
              </label>
              <label className="text-sm">
                Slug (optional)
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={artistSlug} onChange={(e) => setArtistSlug(e.target.value)} />
              </label>
              <label className="text-sm lg:col-span-2">
                Bio
                <textarea className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2 min-h-24" value={artistBio} onChange={(e) => setArtistBio(e.target.value)} />
              </label>
              <label className="text-sm">
                Style tags (comma separated)
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={artistStyles} onChange={(e) => setArtistStyles(e.target.value)} placeholder="ambient, electronic" />
              </label>
              <label className="text-sm">
                Status
                <select className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={artistStatus} onChange={(e) => setArtistStatus(e.target.value as ContentStatus)}>
                  {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm lg:col-span-2">
                Genres
                <select
                  multiple
                  className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2 min-h-28"
                  value={artistGenreIds}
                  onChange={(e) => setArtistGenreIds(Array.from(e.target.selectedOptions).map((opt) => opt.value))}
                >
                  {(genres.data ?? []).map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
                </select>
              </label>
              <div className="lg:col-span-2">
                <button disabled={createArtistMutation.isPending} className="rounded-md bg-accent text-accent-fg px-4 py-2 text-sm font-semibold disabled:opacity-60">
                  {createArtistMutation.isPending ? 'Creating...' : 'Create artist'}
                </button>
              </div>
            </form>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface/70">
                  <tr>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">Slug</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {(artists.data?.items ?? []).map((artist) => {
                    const selectedStatus = artistStatusDraft[artist.id] ?? artist.status
                    return (
                      <tr key={artist.id} className="border-t border-border/60">
                        <td className="px-3 py-2">{artist.name}</td>
                        <td className="px-3 py-2 text-muted-fg">{artist.slug}</td>
                        <td className="px-3 py-2">{artist.status}</td>
                        <td className="px-3 py-2 flex items-center gap-2">
                          <select className="rounded-md bg-background border border-border px-2 py-1" value={selectedStatus} onChange={(e) => setArtistStatusDraft((draft) => ({ ...draft, [artist.id]: e.target.value as ContentStatus }))}>
                            {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                          <button
                            className="rounded-md border border-border px-2 py-1 hover:bg-surface"
                            onClick={() => updateArtistMutation.mutate({ id: artist.id, status: selectedStatus })}
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'albums' && (
          <section className="space-y-4">
            <form onSubmit={onAlbumSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-surface/40">
              <label className="text-sm">
                Title
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={albumTitle} onChange={(e) => setAlbumTitle(e.target.value)} required />
              </label>
              <label className="text-sm">
                Slug (optional)
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={albumSlug} onChange={(e) => setAlbumSlug(e.target.value)} />
              </label>
              <label className="text-sm">
                Artist
                <select className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={albumArtistId} onChange={(e) => setAlbumArtistId(e.target.value)} required>
                  <option value="">Select artist...</option>
                  {activeArtistOptions.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
                </select>
              </label>
              <label className="text-sm">
                Album type
                <select className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={albumType} onChange={(e) => setAlbumType(e.target.value as AlbumType)}>
                  {albumTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm">
                Release date
                <input type="date" className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={albumReleaseDate} onChange={(e) => setAlbumReleaseDate(e.target.value)} />
              </label>
              <label className="text-sm">
                Status
                <select className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={albumStatus} onChange={(e) => setAlbumStatus(e.target.value as ContentStatus)}>
                  {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm lg:col-span-2">
                Description
                <textarea className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2 min-h-24" value={albumDescription} onChange={(e) => setAlbumDescription(e.target.value)} />
              </label>
              <label className="text-sm lg:col-span-2">
                Genres
                <select multiple className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2 min-h-28" value={albumGenreIds} onChange={(e) => setAlbumGenreIds(Array.from(e.target.selectedOptions).map((opt) => opt.value))}>
                  {(genres.data ?? []).map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
                </select>
              </label>
              <div className="lg:col-span-2">
                <button disabled={createAlbumMutation.isPending} className="rounded-md bg-accent text-accent-fg px-4 py-2 text-sm font-semibold disabled:opacity-60">
                  {createAlbumMutation.isPending ? 'Creating...' : 'Create album'}
                </button>
              </div>
            </form>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface/70">
                  <tr>
                    <th className="text-left px-3 py-2">Album</th>
                    <th className="text-left px-3 py-2">Artist</th>
                    <th className="text-left px-3 py-2">Tracks</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {(albums.data?.items ?? []).map((album) => {
                    const selectedStatus = albumStatusDraft[album.id] ?? album.status
                    return (
                      <tr key={album.id} className="border-t border-border/60">
                        <td className="px-3 py-2">{album.title}</td>
                        <td className="px-3 py-2 text-muted-fg">{album.artistName}</td>
                        <td className="px-3 py-2">{album.trackCount}</td>
                        <td className="px-3 py-2">{album.status}</td>
                        <td className="px-3 py-2 flex items-center gap-2">
                          <select className="rounded-md bg-background border border-border px-2 py-1" value={selectedStatus} onChange={(e) => setAlbumStatusDraft((draft) => ({ ...draft, [album.id]: e.target.value as ContentStatus }))}>
                            {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                          <button className="rounded-md border border-border px-2 py-1 hover:bg-surface" onClick={() => updateAlbumMutation.mutate({ id: album.id, status: selectedStatus })}>Save</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'tracks' && (
          <section className="space-y-4">
            <form onSubmit={onTrackSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-surface/40">
              <label className="text-sm">
                Title
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} required />
              </label>
              <label className="text-sm">
                Album
                <select className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={trackAlbumId} onChange={(e) => setTrackAlbumId(e.target.value)} required>
                  <option value="">Select album...</option>
                  {activeAlbumOptions.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
                </select>
              </label>
              <label className="text-sm">
                Primary artist (optional)
                <select className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={trackArtistId} onChange={(e) => setTrackArtistId(e.target.value)}>
                  <option value="">Use album artist</option>
                  {activeArtistOptions.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
                </select>
              </label>
              <label className="text-sm">
                Status
                <select className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={trackStatus} onChange={(e) => setTrackStatus(e.target.value as ContentStatus)}>
                  {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm">
                Track number
                <input type="number" min={1} className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={trackNumber} onChange={(e) => setTrackNumber(e.target.value)} />
              </label>
              <label className="text-sm">
                Disc number
                <input type="number" min={1} className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={discNumber} onChange={(e) => setDiscNumber(e.target.value)} />
              </label>
              <label className="text-sm">
                Duration (ms)
                <input type="number" min={0} className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={durationMs} onChange={(e) => setDurationMs(e.target.value)} />
              </label>
              <label className="text-sm flex items-end gap-2">
                <input type="checkbox" checked={trackExplicit} onChange={(e) => setTrackExplicit(e.target.checked)} />
                Explicit track
              </label>
              <label className="text-sm lg:col-span-2">
                Audio file path (optional)
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={audioPath} onChange={(e) => setAudioPath(e.target.value)} placeholder="data/audio/my-song.mp3" />
              </label>
              <label className="text-sm">
                Audio quality
                <select className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={audioQuality} onChange={(e) => setAudioQuality(e.target.value as TrackAudioFile['quality'])}>
                  <option value="low_128">low_128</option>
                  <option value="standard_256">standard_256</option>
                  <option value="high_320">high_320</option>
                  <option value="lossless">lossless</option>
                </select>
              </label>
              <label className="text-sm">
                Audio format
                <select className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={audioFormat} onChange={(e) => setAudioFormat(e.target.value as TrackAudioFile['format'])}>
                  <option value="mp3">mp3</option>
                  <option value="aac">aac</option>
                  <option value="ogg">ogg</option>
                  <option value="flac">flac</option>
                  <option value="opus">opus</option>
                </select>
              </label>
              <label className="text-sm lg:col-span-2">
                Genres
                <select multiple className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2 min-h-28" value={trackGenreIds} onChange={(e) => setTrackGenreIds(Array.from(e.target.selectedOptions).map((opt) => opt.value))}>
                  {(genres.data ?? []).map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
                </select>
              </label>
              <div className="lg:col-span-2">
                <button disabled={createTrackMutation.isPending} className="rounded-md bg-accent text-accent-fg px-4 py-2 text-sm font-semibold disabled:opacity-60">
                  {createTrackMutation.isPending ? 'Creating...' : 'Create track'}
                </button>
              </div>
            </form>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface/70">
                  <tr>
                    <th className="text-left px-3 py-2">Track</th>
                    <th className="text-left px-3 py-2">Album</th>
                    <th className="text-left px-3 py-2">Artist</th>
                    <th className="text-left px-3 py-2">Duration</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {(tracks.data?.items ?? []).map((track) => {
                    const selectedStatus = trackStatusDraft[track.id] ?? track.status
                    return (
                      <tr key={track.id} className="border-t border-border/60">
                        <td className="px-3 py-2">{track.title}</td>
                        <td className="px-3 py-2 text-muted-fg">{track.albumTitle}</td>
                        <td className="px-3 py-2 text-muted-fg">{track.primaryArtistName}</td>
                        <td className="px-3 py-2">{Math.round(track.durationMs / 1000)}s</td>
                        <td className="px-3 py-2">{track.status}</td>
                        <td className="px-3 py-2 flex items-center gap-2">
                          <select className="rounded-md bg-background border border-border px-2 py-1" value={selectedStatus} onChange={(e) => setTrackStatusDraft((draft) => ({ ...draft, [track.id]: e.target.value as ContentStatus }))}>
                            {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                          <button className="rounded-md border border-border px-2 py-1 hover:bg-surface" onClick={() => updateTrackMutation.mutate({ id: track.id, status: selectedStatus })}>Save</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
