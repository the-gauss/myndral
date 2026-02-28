import type { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormEvent, useMemo, useState } from 'react'
import {
  createAlbum,
  createArtist,
  createTrack,
  inspectAudio,
  listAlbums,
  listArtists,
  listGenres,
  listTracks,
  updateAlbum,
  updateArtist,
  updateTrack,
} from '../services/internal'
import { useAuthStore } from '../store/authStore'
import type { AlbumType, AudioInspection, ContentStatus, TrackAudioFile } from '../types'

type Tab = 'artists' | 'albums' | 'tracks'
type StatusFilter = ContentStatus | 'all'

const statusOptions: ContentStatus[] = ['draft', 'review', 'published', 'archived']
const statusFilterOptions: StatusFilter[] = ['all', ...statusOptions]
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

function asErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ detail?: string }>
  return axiosError.response?.data?.detail ?? fallback
}

function formatBytes(value: number | undefined): string {
  if (value === undefined || value <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let amount = value
  let unitIndex = 0
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }
  return `${amount.toFixed(1)} ${units[unitIndex]}`
}

export default function Dashboard() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const clearSession = useAuthStore((s) => s.clearSession)

  const [tab, setTab] = useState<Tab>('artists')

  // Search/filter controls so existing catalog can be explored on-demand.
  const [artistSearch, setArtistSearch] = useState('')
  const [artistStatusFilter, setArtistStatusFilter] = useState<StatusFilter>('all')

  const [albumSearch, setAlbumSearch] = useState('')
  const [albumStatusFilter, setAlbumStatusFilter] = useState<StatusFilter>('all')
  const [albumArtistFilter, setAlbumArtistFilter] = useState<string>('all')

  const [trackSearch, setTrackSearch] = useState('')
  const [trackStatusFilter, setTrackStatusFilter] = useState<StatusFilter>('all')
  const [trackArtistFilter, setTrackArtistFilter] = useState<string>('all')
  const [trackAlbumFilter, setTrackAlbumFilter] = useState<string>('all')

  const genres = useQuery({ queryKey: ['genres'], queryFn: listGenres })

  const artistOptionsQuery = useQuery({
    queryKey: ['artists-options'],
    queryFn: () => listArtists({ limit: 500 }),
  })
  const albumOptionsQuery = useQuery({
    queryKey: ['albums-options'],
    queryFn: () => listAlbums({ limit: 500 }),
  })

  const artists = useQuery({
    queryKey: ['artists', artistStatusFilter, artistSearch],
    queryFn: () => listArtists({
      limit: 250,
      status: artistStatusFilter === 'all' ? undefined : artistStatusFilter,
      q: artistSearch.trim() || undefined,
    }),
  })

  const albums = useQuery({
    queryKey: ['albums', albumStatusFilter, albumArtistFilter, albumSearch],
    queryFn: () => listAlbums({
      limit: 250,
      status: albumStatusFilter === 'all' ? undefined : albumStatusFilter,
      artistId: albumArtistFilter === 'all' ? undefined : albumArtistFilter,
      q: albumSearch.trim() || undefined,
    }),
  })

  const tracks = useQuery({
    queryKey: ['tracks', trackStatusFilter, trackArtistFilter, trackAlbumFilter, trackSearch],
    queryFn: () => listTracks({
      limit: 250,
      status: trackStatusFilter === 'all' ? undefined : trackStatusFilter,
      artistId: trackArtistFilter === 'all' ? undefined : trackArtistFilter,
      albumId: trackAlbumFilter === 'all' ? undefined : trackAlbumFilter,
      q: trackSearch.trim() || undefined,
    }),
  })

  const activeArtistOptions = artistOptionsQuery.data?.items ?? []
  const activeAlbumOptions = albumOptionsQuery.data?.items ?? []

  const [artistName, setArtistName] = useState('')
  const [artistSlug, setArtistSlug] = useState('')
  const [artistBio, setArtistBio] = useState('')
  const [artistImageUrl, setArtistImageUrl] = useState('')
  const [artistHeaderImageUrl, setArtistHeaderImageUrl] = useState('')
  const [artistPersonaPrompt, setArtistPersonaPrompt] = useState('')
  const [artistStyles, setArtistStyles] = useState('')
  const [artistStatus, setArtistStatus] = useState<ContentStatus>('draft')
  const [artistGenreIds, setArtistGenreIds] = useState<string[]>([])
  const [artistFormError, setArtistFormError] = useState<string | null>(null)

  const [albumTitle, setAlbumTitle] = useState('')
  const [albumSlug, setAlbumSlug] = useState('')
  const [albumArtistId, setAlbumArtistId] = useState('')
  const [albumDescription, setAlbumDescription] = useState('')
  const [albumReleaseDate, setAlbumReleaseDate] = useState('')
  const [albumCoverUrl, setAlbumCoverUrl] = useState('')
  const [albumType, setAlbumType] = useState<AlbumType>('album')
  const [albumStatus, setAlbumStatus] = useState<ContentStatus>('draft')
  const [albumGenreIds, setAlbumGenreIds] = useState<string[]>([])
  const [albumFormError, setAlbumFormError] = useState<string | null>(null)

  const [trackTitle, setTrackTitle] = useState('')
  const [trackAlbumId, setTrackAlbumId] = useState('')
  const [trackArtistId, setTrackArtistId] = useState('')
  const [trackNumber, setTrackNumber] = useState('1')
  const [discNumber, setDiscNumber] = useState('1')
  const [durationMs, setDurationMs] = useState('')
  const [trackStatus, setTrackStatus] = useState<ContentStatus>('draft')
  const [trackExplicit, setTrackExplicit] = useState(false)
  const [trackGenreIds, setTrackGenreIds] = useState<string[]>([])
  const [audioPath, setAudioPath] = useState('')
  const [audioQuality, setAudioQuality] = useState<TrackAudioFile['quality']>('high_320')
  const [audioFormat, setAudioFormat] = useState<TrackAudioFile['format']>('mp3')
  const [audioBitrateKbps, setAudioBitrateKbps] = useState('')
  const [audioSampleRateHz, setAudioSampleRateHz] = useState('')
  const [audioChannels, setAudioChannels] = useState('2')
  const [audioFileSizeBytes, setAudioFileSizeBytes] = useState('')
  const [audioChecksumSha256, setAudioChecksumSha256] = useState('')
  const [audioInspectError, setAudioInspectError] = useState<string | null>(null)
  const [trackFormError, setTrackFormError] = useState<string | null>(null)

  const [artistStatusDraft, setArtistStatusDraft] = useState<Record<string, ContentStatus>>({})
  const [albumStatusDraft, setAlbumStatusDraft] = useState<Record<string, ContentStatus>>({})
  const [trackStatusDraft, setTrackStatusDraft] = useState<Record<string, ContentStatus>>({})

  const createArtistMutation = useMutation({
    mutationFn: createArtist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artists'] })
      queryClient.invalidateQueries({ queryKey: ['artists-options'] })
      setArtistName('')
      setArtistSlug('')
      setArtistBio('')
      setArtistImageUrl('')
      setArtistHeaderImageUrl('')
      setArtistPersonaPrompt('')
      setArtistStyles('')
      setArtistGenreIds([])
      setArtistStatus('draft')
      setArtistFormError(null)
    },
  })

  const createAlbumMutation = useMutation({
    mutationFn: createAlbum,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      queryClient.invalidateQueries({ queryKey: ['albums-options'] })
      setAlbumTitle('')
      setAlbumSlug('')
      setAlbumDescription('')
      setAlbumReleaseDate('')
      setAlbumCoverUrl('')
      setAlbumGenreIds([])
      setAlbumStatus('draft')
      setAlbumFormError(null)
    },
  })

  const inspectAudioMutation = useMutation({
    mutationFn: inspectAudio,
    onSuccess: (inspection: AudioInspection) => {
      if (inspection.durationMs && inspection.durationMs > 0) {
        setDurationMs(String(inspection.durationMs))
      }
      if (inspection.format) {
        setAudioFormat(inspection.format)
      }
      if (inspection.bitrateKbps) {
        setAudioBitrateKbps(String(inspection.bitrateKbps))
      }
      if (inspection.sampleRateHz) {
        setAudioSampleRateHz(String(inspection.sampleRateHz))
      }
      if (inspection.channels) {
        setAudioChannels(String(inspection.channels))
      }
      if (inspection.fileSizeBytes) {
        setAudioFileSizeBytes(String(inspection.fileSizeBytes))
      }
      if (inspection.checksumSha256) {
        setAudioChecksumSha256(inspection.checksumSha256)
      }
      setAudioInspectError(null)
    },
    onError: (error) => {
      setAudioInspectError(asErrorMessage(error, 'Unable to inspect audio metadata.'))
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
      setDurationMs('')
      setTrackExplicit(false)
      setTrackStatus('draft')
      setTrackGenreIds([])
      setAudioPath('')
      setAudioQuality('high_320')
      setAudioFormat('mp3')
      setAudioBitrateKbps('')
      setAudioSampleRateHz('')
      setAudioChannels('2')
      setAudioFileSizeBytes('')
      setAudioChecksumSha256('')
      setTrackFormError(null)
      setAudioInspectError(null)
    },
  })

  const updateArtistMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) => updateArtist(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artists'] })
      queryClient.invalidateQueries({ queryKey: ['artists-options'] })
    },
  })

  const updateAlbumMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) => updateAlbum(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      queryClient.invalidateQueries({ queryKey: ['albums-options'] })
    },
  })

  const updateTrackMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) => updateTrack(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tracks'] }),
  })

  function onArtistSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setArtistFormError(null)

    if (artistStatus === 'published' && !artistImageUrl.trim()) {
      setArtistFormError('Published artists require a portrait image URL/path.')
      return
    }
    if (artistStatus === 'published' && !artistBio.trim()) {
      setArtistFormError('Published artists require a meaningful bio.')
      return
    }

    createArtistMutation.mutate({
      name: artistName,
      slug: artistSlug || undefined,
      bio: artistBio || undefined,
      imageUrl: artistImageUrl || undefined,
      headerImageUrl: artistHeaderImageUrl || undefined,
      personaPrompt: artistPersonaPrompt || undefined,
      status: artistStatus,
      styleTags: parseCsv(artistStyles),
      genreIds: artistGenreIds,
    })
  }

  function onAlbumSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAlbumFormError(null)
    if (!albumArtistId) {
      setAlbumFormError('Select an artist for the album.')
      return
    }
    if (albumStatus === 'published' && !albumCoverUrl.trim()) {
      setAlbumFormError('Published albums require cover art URL/path.')
      return
    }
    if (albumStatus === 'published' && !albumReleaseDate) {
      setAlbumFormError('Published albums require a release date.')
      return
    }

    createAlbumMutation.mutate({
      title: albumTitle,
      slug: albumSlug || undefined,
      artistId: albumArtistId,
      coverUrl: albumCoverUrl || undefined,
      description: albumDescription || undefined,
      releaseDate: albumReleaseDate || undefined,
      albumType,
      status: albumStatus,
      genreIds: albumGenreIds,
    })
  }

  function inspectCurrentAudioPath() {
    const storageUrl = audioPath.trim()
    if (!storageUrl) return
    inspectAudioMutation.mutate({ storageUrl })
  }

  function onTrackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTrackFormError(null)
    if (!trackAlbumId) {
      setTrackFormError('Select an album for the track.')
      return
    }
    if (trackStatus === 'published' && !audioPath.trim()) {
      setTrackFormError('Published tracks require an audio file path.')
      return
    }

    const audioFiles = audioPath.trim()
      ? [{
          quality: audioQuality,
          format: audioFormat,
          storageUrl: audioPath.trim(),
          channels: Number(audioChannels) || 2,
          bitrateKbps: parseNumber(audioBitrateKbps),
          sampleRateHz: parseNumber(audioSampleRateHz),
          fileSizeBytes: parseNumber(audioFileSizeBytes),
          durationMs: parseNumber(durationMs),
          checksumSha256: audioChecksumSha256.trim() || undefined,
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

  const loading = genres.isLoading
    || artistOptionsQuery.isLoading
    || albumOptionsQuery.isLoading
    || artists.isLoading
    || albums.isLoading
    || tracks.isLoading

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
            Add and manage catalog entries. Existing records are searchable below for quick edits.
          </p>
        </header>

        {loading && <p className="text-sm text-muted-fg">Loading catalog metadata...</p>}

        {tab === 'artists' && (
          <section className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-lg border border-border bg-surface/40">
              <label className="text-sm">
                Search artists
                <input
                  className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                  value={artistSearch}
                  onChange={(e) => setArtistSearch(e.target.value)}
                  placeholder="name or slug"
                />
              </label>
              <label className="text-sm">
                Status filter
                <select
                  className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                  value={artistStatusFilter}
                  onChange={(e) => setArtistStatusFilter(e.target.value as StatusFilter)}
                >
                  {statusFilterOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <div className="text-sm flex items-end text-muted-fg">
                {artists.data?.total ?? 0} artist{(artists.data?.total ?? 0) === 1 ? '' : 's'} found
              </div>
            </div>

            <form onSubmit={onArtistSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-surface/40">
              <label className="text-sm">
                Name
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={artistName} onChange={(e) => setArtistName(e.target.value)} required />
              </label>
              <label className="text-sm">
                Slug (optional)
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={artistSlug} onChange={(e) => setArtistSlug(e.target.value)} />
              </label>
              <label className="text-sm">
                Portrait image URL/path
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={artistImageUrl} onChange={(e) => setArtistImageUrl(e.target.value)} placeholder="data/images/artist.jpg or https://..." />
              </label>
              <label className="text-sm">
                Header image URL/path (optional)
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={artistHeaderImageUrl} onChange={(e) => setArtistHeaderImageUrl(e.target.value)} placeholder="data/images/artist-header.jpg" />
              </label>
              <label className="text-sm lg:col-span-2">
                Bio
                <textarea className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2 min-h-24" value={artistBio} onChange={(e) => setArtistBio(e.target.value)} />
              </label>
              <label className="text-sm lg:col-span-2">
                Persona prompt (optional)
                <textarea className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2 min-h-20" value={artistPersonaPrompt} onChange={(e) => setArtistPersonaPrompt(e.target.value)} />
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
              {artistFormError && (
                <p className="lg:col-span-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  {artistFormError}
                </p>
              )}
              {createArtistMutation.error && (
                <p className="lg:col-span-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {asErrorMessage(createArtistMutation.error, 'Failed to create artist.')}
                </p>
              )}
              <div className="lg:col-span-2">
                <p className="mb-2 text-xs text-muted-fg">Published artists require `imageUrl` and `bio`.</p>
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
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Portrait</th>
                    <th className="text-left px-3 py-2">Updated</th>
                    <th className="text-left px-3 py-2">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {(artists.data?.items ?? []).map((artist) => {
                    const selectedStatus = artistStatusDraft[artist.id] ?? artist.status
                    return (
                      <tr key={artist.id} className="border-t border-border/60">
                        <td className="px-3 py-2">
                          <p className="font-medium">{artist.name}</p>
                          <p className="text-xs text-muted-fg">{artist.slug}</p>
                        </td>
                        <td className="px-3 py-2">{artist.status}</td>
                        <td className="px-3 py-2 text-xs text-muted-fg">{artist.imageUrl ? 'Configured' : 'Missing'}</td>
                        <td className="px-3 py-2 text-xs text-muted-fg">{new Date(artist.updatedAt).toLocaleString()}</td>
                        <td className="px-3 py-2 flex items-center gap-2">
                          <select className="rounded-md bg-background border border-border px-2 py-1" value={selectedStatus} onChange={(e) => setArtistStatusDraft((draft) => ({ ...draft, [artist.id]: e.target.value as ContentStatus }))}>
                            {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                          <button
                            className="rounded-md border border-border px-2 py-1 hover:bg-surface disabled:opacity-60"
                            disabled={updateArtistMutation.isPending}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-lg border border-border bg-surface/40">
              <label className="text-sm">
                Search albums
                <input
                  className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                  value={albumSearch}
                  onChange={(e) => setAlbumSearch(e.target.value)}
                  placeholder="title or slug"
                />
              </label>
              <label className="text-sm">
                Status filter
                <select
                  className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                  value={albumStatusFilter}
                  onChange={(e) => setAlbumStatusFilter(e.target.value as StatusFilter)}
                >
                  {statusFilterOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm">
                Artist filter
                <select
                  className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                  value={albumArtistFilter}
                  onChange={(e) => setAlbumArtistFilter(e.target.value)}
                >
                  <option value="all">All artists</option>
                  {activeArtistOptions.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
                </select>
              </label>
              <div className="text-sm flex items-end text-muted-fg">
                {albums.data?.total ?? 0} album{(albums.data?.total ?? 0) === 1 ? '' : 's'} found
              </div>
            </div>

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
                Cover art URL/path
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={albumCoverUrl} onChange={(e) => setAlbumCoverUrl(e.target.value)} placeholder="data/images/album-cover.jpg or https://..." />
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
              {albumFormError && (
                <p className="lg:col-span-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  {albumFormError}
                </p>
              )}
              {createAlbumMutation.error && (
                <p className="lg:col-span-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {asErrorMessage(createAlbumMutation.error, 'Failed to create album.')}
                </p>
              )}
              <div className="lg:col-span-2">
                <p className="mb-2 text-xs text-muted-fg">Published albums require `coverUrl` and `releaseDate`.</p>
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
                    <th className="text-left px-3 py-2">Cover</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {(albums.data?.items ?? []).map((album) => {
                    const selectedStatus = albumStatusDraft[album.id] ?? album.status
                    return (
                      <tr key={album.id} className="border-t border-border/60">
                        <td className="px-3 py-2">
                          <p className="font-medium">{album.title}</p>
                          <p className="text-xs text-muted-fg">{album.slug}</p>
                        </td>
                        <td className="px-3 py-2 text-muted-fg">{album.artistName}</td>
                        <td className="px-3 py-2">{album.trackCount}</td>
                        <td className="px-3 py-2 text-xs text-muted-fg">{album.coverUrl ? 'Configured' : 'Missing'}</td>
                        <td className="px-3 py-2">{album.status}</td>
                        <td className="px-3 py-2 flex items-center gap-2">
                          <select className="rounded-md bg-background border border-border px-2 py-1" value={selectedStatus} onChange={(e) => setAlbumStatusDraft((draft) => ({ ...draft, [album.id]: e.target.value as ContentStatus }))}>
                            {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                          <button className="rounded-md border border-border px-2 py-1 hover:bg-surface disabled:opacity-60" disabled={updateAlbumMutation.isPending} onClick={() => updateAlbumMutation.mutate({ id: album.id, status: selectedStatus })}>Save</button>
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 rounded-lg border border-border bg-surface/40">
              <label className="text-sm">
                Search tracks
                <input
                  className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                  value={trackSearch}
                  onChange={(e) => setTrackSearch(e.target.value)}
                  placeholder="track title"
                />
              </label>
              <label className="text-sm">
                Status filter
                <select
                  className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                  value={trackStatusFilter}
                  onChange={(e) => setTrackStatusFilter(e.target.value as StatusFilter)}
                >
                  {statusFilterOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-sm">
                Artist filter
                <select
                  className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                  value={trackArtistFilter}
                  onChange={(e) => setTrackArtistFilter(e.target.value)}
                >
                  <option value="all">All artists</option>
                  {activeArtistOptions.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
                </select>
              </label>
              <label className="text-sm">
                Album filter
                <select
                  className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                  value={trackAlbumFilter}
                  onChange={(e) => setTrackAlbumFilter(e.target.value)}
                >
                  <option value="all">All albums</option>
                  {activeAlbumOptions.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
                </select>
              </label>
              <div className="text-sm flex items-end text-muted-fg">
                {tracks.data?.total ?? 0} track{(tracks.data?.total ?? 0) === 1 ? '' : 's'} found
              </div>
            </div>

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
                Audio file path
                <div className="mt-1 flex gap-2">
                  <input
                    className="w-full rounded-md bg-background border border-border px-3 py-2"
                    value={audioPath}
                    onChange={(e) => setAudioPath(e.target.value)}
                    onBlur={inspectCurrentAudioPath}
                    placeholder="data/audio/my-song.mp3"
                  />
                  <button
                    type="button"
                    onClick={inspectCurrentAudioPath}
                    disabled={!audioPath.trim() || inspectAudioMutation.isPending}
                    className="rounded-md border border-border px-3 py-2 text-xs hover:bg-surface disabled:opacity-60"
                  >
                    {inspectAudioMutation.isPending ? 'Inspecting...' : 'Infer'}
                  </button>
                </div>
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
              <label className="text-sm">
                Bitrate (kbps)
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={audioBitrateKbps} onChange={(e) => setAudioBitrateKbps(e.target.value)} />
              </label>
              <label className="text-sm">
                Sample rate (Hz)
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={audioSampleRateHz} onChange={(e) => setAudioSampleRateHz(e.target.value)} />
              </label>
              <label className="text-sm">
                Channels
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={audioChannels} onChange={(e) => setAudioChannels(e.target.value)} />
              </label>
              <label className="text-sm">
                File size (bytes)
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2" value={audioFileSizeBytes} onChange={(e) => setAudioFileSizeBytes(e.target.value)} />
              </label>
              <label className="text-sm lg:col-span-2">
                SHA-256 checksum
                <input className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2 font-mono text-xs" value={audioChecksumSha256} onChange={(e) => setAudioChecksumSha256(e.target.value)} />
              </label>
              <label className="text-sm lg:col-span-2">
                Genres
                <select multiple className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2 min-h-28" value={trackGenreIds} onChange={(e) => setTrackGenreIds(Array.from(e.target.selectedOptions).map((opt) => opt.value))}>
                  {(genres.data ?? []).map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
                </select>
              </label>

              {audioPath.trim() && (
                <p className="lg:col-span-2 text-xs text-muted-fg">
                  Local file details: {formatBytes(parseNumber(audioFileSizeBytes))} {audioSampleRateHz ? `· ${audioSampleRateHz} Hz` : ''} {audioBitrateKbps ? `· ${audioBitrateKbps} kbps` : ''}
                </p>
              )}
              {audioInspectError && (
                <p className="lg:col-span-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  {audioInspectError}
                </p>
              )}
              {trackFormError && (
                <p className="lg:col-span-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  {trackFormError}
                </p>
              )}
              {createTrackMutation.error && (
                <p className="lg:col-span-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {asErrorMessage(createTrackMutation.error, 'Failed to create track.')}
                </p>
              )}
              <div className="lg:col-span-2">
                <p className="mb-2 text-xs text-muted-fg">Published tracks require playable audio and duration.</p>
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
                    <th className="text-left px-3 py-2">Audio</th>
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
                        <td className="px-3 py-2 text-xs text-muted-fg">{track.audioFiles.length} file{track.audioFiles.length === 1 ? '' : 's'}</td>
                        <td className="px-3 py-2">{track.status}</td>
                        <td className="px-3 py-2 flex items-center gap-2">
                          <select className="rounded-md bg-background border border-border px-2 py-1" value={selectedStatus} onChange={(e) => setTrackStatusDraft((draft) => ({ ...draft, [track.id]: e.target.value as ContentStatus }))}>
                            {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                          <button className="rounded-md border border-border px-2 py-1 hover:bg-surface disabled:opacity-60" disabled={updateTrackMutation.isPending} onClick={() => updateTrackMutation.mutate({ id: track.id, status: selectedStatus })}>Save</button>
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
