/**
 * CreateMusicPanel — create songs via AI generation or file upload, and browse the song catalog.
 *
 * Creation flow (consistent with Artist/Album panels):
 *   fill form → Preview & Submit card → confirm → API call → staging
 *
 * Upload modes in the upload tab:
 *   - "Upload file": multipart POST with the raw audio file
 *   - "Link external URL": JSON POST with a CDN/data/ URL for already-hosted files
 *
 * The catalog browse section at the bottom replaces the removed standalone Tracks tab.
 */
import type { AxiosError } from 'axios'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchGeneratedMusicFile,
  generateMusic,
  linkExternalUrl,
  uploadCustomMusic,
  listAlbums,
  listArtists,
  listMusicJobs,
  listTracks,
  revokeTrack as revokeTrackApi,
} from '../services/internal'
import type {
  ArtistItem,
  AlbumItem,
  ContentStatus,
  MusicGenerateRequest,
  MusicGenerationJob,
  TrackItem,
} from '../types'
import type { LinkExternalUrlPayload, UploadMusicPayload } from '../services/internal'
import { useAuthStore } from '../store/authStore'

// ── Tab types ──────────────────────────────────────────────────────────────────

type CreatorTab = 'song' | 'lyrics' | 'upload'
type UploadMode = 'file' | 'url'

// Discriminated union so the preview card always knows what it's confirming.
type PendingAction =
  | { mode: 'generate'; params: MusicGenerateRequest; artistName: string; albumTitle: string }
  | { mode: 'upload';   payload: UploadMusicPayload;  artistName: string; albumTitle: string }
  | { mode: 'link';     payload: LinkExternalUrlPayload; artistName: string; albumTitle: string }

const ACCEPTED_AUDIO = '.mp3,.m4a,.wav,.flac,.ogg,.opus,.aac,audio/*'

// ── Utility helpers ────────────────────────────────────────────────────────────

function parseOptionalInt(raw: string): number | undefined {
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function asErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ detail?: unknown }>
  const detail = axiosError?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  if (Array.isArray(detail) && detail.length > 0) {
    const first = (detail[0] as { msg?: string })?.msg
    return first ? `Validation error: ${first}` : fallback
  }
  const raw: unknown = axiosError?.response?.data
  if (typeof raw === 'string' && raw.trim() && !raw.trim().startsWith('<')) return raw.trim()
  return fallback
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatDuration(job: MusicGenerationJob): string {
  const durationMs = Number(job.outputMetadata?.durationMs)
  if (!Number.isFinite(durationMs) || durationMs <= 0) return '-'
  return `${Math.round(durationMs / 1000)}s`
}

function formatFileSize(job: MusicGenerationJob): string {
  const raw = Number(job.outputMetadata?.fileSizeBytes)
  if (!Number.isFinite(raw) || raw <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let amount = raw
  let unitIndex = 0
  while (amount >= 1024 && unitIndex < units.length - 1) { amount /= 1024; unitIndex += 1 }
  return `${amount.toFixed(1)} ${units[unitIndex]}`
}

function getSongTitle(job: MusicGenerationJob): string | null {
  const metadata = job.outputMetadata?.songMetadata
  if (!metadata || typeof metadata !== 'object') return null
  const title = (metadata as Record<string, unknown>).title
  return typeof title === 'string' && title.trim() ? title.trim() : null
}

function getLyrics(job: MusicGenerationJob): string | null {
  const lyrics = job.outputMetadata?.lyrics
  return typeof lyrics === 'string' && lyrics.trim() ? lyrics.trim() : null
}

function formatTrackDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '-'
  const totalSeconds = Math.round(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Status badge (shared with other panels) ────────────────────────────────────

function StatusBadge({ status }: { status: ContentStatus }) {
  const cls =
    status === 'published' ? 'bg-green-500/15 text-green-300 border-green-500/30' :
    status === 'review'    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                             'bg-surface text-muted-fg border-border'
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-xs capitalize ${cls}`}>
      {status}
    </span>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CreateMusicPanel() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'

  // ── Catalog linking fields ─────────────────────────────────────────────────
  const [selectedArtistId, setSelectedArtistId] = useState('')
  const [selectedAlbumId, setSelectedAlbumId]   = useState('')
  const [trackTitle, setTrackTitle]             = useState('')
  const [explicit, setExplicit]                 = useState(false)

  // ── Generation params (song / lyrics tabs) ────────────────────────────────
  const [activeTab, setActiveTab]               = useState<CreatorTab>('song')
  const [prompt, setPrompt]                     = useState('')
  const [styleNote, setStyleNote]               = useState('')
  const [negativePrompt, setNegativePrompt]     = useState('')
  const [lengthSeconds, setLengthSeconds]       = useState('150')
  const [fileName, setFileName]                 = useState('')
  const [seed, setSeed]                         = useState('')
  const [forceInstrumental, setForceInstrumental] = useState(false)
  const [useCustomLyrics, setUseCustomLyrics]   = useState(false)
  const [lyrics, setLyrics]                     = useState('')
  const [withTimestamps, setWithTimestamps]     = useState(false)

  // ── Upload tab ────────────────────────────────────────────────────────────
  const [uploadMode, setUploadMode]   = useState<UploadMode>('file')
  const [uploadFile, setUploadFile]   = useState<File | null>(null)
  const [linkUrl, setLinkUrl]         = useState('')
  const [uploadLyrics, setUploadLyrics] = useState('')

  // ── Preview / confirm step ─────────────────────────────────────────────────
  // null = form is visible; non-null = confirmation card is visible.
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [formError, setFormError]         = useState<string | null>(null)
  const [successTitle, setSuccessTitle]   = useState<string | null>(null)

  // ── Audio preview (job result) ─────────────────────────────────────────────
  const [previewUrl, setPreviewUrl]       = useState<string | null>(null)
  const [previewJobId, setPreviewJobId]   = useState<string | null>(null)
  const [previewTitle, setPreviewTitle]   = useState<string | null>(null)
  const [previewLyrics, setPreviewLyrics] = useState<string | null>(null)
  const [previewError, setPreviewError]   = useState<string | null>(null)

  // ── Track revoke confirmation (admin-only) ────────────────────────────────
  const [revokeTarget, setRevokeTarget] = useState<TrackItem | null>(null)
  const [revokeNotes, setRevokeNotes]   = useState('')

  // ── Catalog browse filters ─────────────────────────────────────────────────
  const [catalogSearch, setCatalogSearch]           = useState('')
  const [catalogArtistFilter, setCatalogArtistFilter] = useState('all')
  const [catalogStatusFilter, setCatalogStatusFilter] = useState<ContentStatus | 'all'>('all')

  // ── Data queries ───────────────────────────────────────────────────────────

  // Show all non-archived artists so staged artists can have songs assigned to them.
  const artistsQuery = useQuery({
    queryKey: ['internal-artists-all'],
    queryFn: () => listArtists({ limit: 200 }),
  })

  const albumsQuery = useQuery({
    queryKey: ['internal-albums-for-artist', selectedArtistId],
    queryFn: () => listAlbums({ artistId: selectedArtistId, limit: 200 }),
    enabled: !!selectedArtistId,
  })

  const jobs = useQuery({
    queryKey: ['music-jobs'],
    queryFn: () => listMusicJobs({ limit: 50 }),
  })

  const tracksQuery = useQuery({
    queryKey: ['tracks', catalogStatusFilter, catalogArtistFilter, catalogSearch],
    queryFn: () => listTracks({
      limit: 100,
      status: catalogStatusFilter === 'all' ? undefined : catalogStatusFilter,
      artistId: catalogArtistFilter === 'all' ? undefined : catalogArtistFilter,
      q: catalogSearch.trim() || undefined,
    }),
  })

  // Reset album when artist changes
  useEffect(() => { setSelectedAlbumId('') }, [selectedArtistId])

  // Instrumental mode forces off custom lyrics
  useEffect(() => {
    if (forceInstrumental) { setUseCustomLyrics(false); setActiveTab('song') }
  }, [forceInstrumental])

  // Revoke blob URLs on unmount to avoid memory leaks
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  // ── Mutations ─────────────────────────────────────────────────────────────

  function onMutationSuccess(title: string) {
    setSuccessTitle(title)
    setPendingAction(null)
    setFormError(null)
    queryClient.invalidateQueries({ queryKey: ['music-jobs'] })
    queryClient.invalidateQueries({ queryKey: ['staging'] })
    queryClient.invalidateQueries({ queryKey: ['tracks'] })
  }

  const createMusicMutation = useMutation({
    mutationFn: generateMusic,
    onSuccess: (_, vars) => onMutationSuccess(vars.trackTitle),
  })

  const uploadMutation = useMutation({
    mutationFn: uploadCustomMusic,
    onSuccess: (_, vars) => {
      setUploadFile(null)
      setUploadLyrics('')
      onMutationSuccess(vars.trackTitle)
    },
  })

  const linkMutation = useMutation({
    mutationFn: linkExternalUrl,
    onSuccess: (_, vars) => {
      setLinkUrl('')
      setUploadLyrics('')
      onMutationSuccess(vars.trackTitle)
    },
  })

  const previewMutation = useMutation({
    mutationFn: async (job: MusicGenerationJob) => {
      const blob = await fetchGeneratedMusicFile(job.outputStorageUrl!)
      return { blob, jobId: job.id, title: getSongTitle(job), lyrics: getLyrics(job) }
    },
    onSuccess: ({ blob, jobId, title, lyrics: lyr }) => {
      setPreviewError(null)
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return URL.createObjectURL(blob)
      })
      setPreviewJobId(jobId)
      setPreviewTitle(title)
      setPreviewLyrics(lyr)
    },
    onError: (error) => setPreviewError(asErrorMessage(error, 'Failed to load audio file.')),
  })

  const revokeMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      revokeTrackApi(id, notes.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] })
      queryClient.invalidateQueries({ queryKey: ['staging'] })
      setRevokeTarget(null)
      setRevokeNotes('')
    },
  })

  // ── Derived data ──────────────────────────────────────────────────────────

  const controlsEnabled = useMemo(
    () => !createMusicMutation.isPending && !uploadMutation.isPending && !linkMutation.isPending,
    [createMusicMutation.isPending, uploadMutation.isPending, linkMutation.isPending],
  )

  // Exclude archived artists from the selector
  const selectableArtists: ArtistItem[] = (artistsQuery.data?.items ?? []).filter(
    (a) => a.status !== 'archived',
  )
  const albumsForArtist: AlbumItem[] = albumsQuery.data?.items ?? []
  const artistMap = Object.fromEntries(selectableArtists.map((a) => [a.id, a.name]))
  const albumMap  = Object.fromEntries(albumsForArtist.map((a) => [a.id, a.title]))

  const noArtists = !artistsQuery.isLoading && selectableArtists.length === 0
  const noAlbums  = !!selectedArtistId && !albumsQuery.isLoading && albumsForArtist.length === 0

  // ── Form validation + preview step ────────────────────────────────────────

  function buildCatalogFields() {
    return { artistName: artistMap[selectedArtistId] ?? selectedArtistId, albumTitle: albumMap[selectedAlbumId] ?? selectedAlbumId }
  }

  function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setSuccessTitle(null)

    if (!selectedArtistId) { setFormError('Select an artist.'); return }
    if (!selectedAlbumId)  { setFormError('Select an album.'); return }
    if (!trackTitle.trim()) { setFormError('Track title is required.'); return }

    const { artistName, albumTitle } = buildCatalogFields()

    if (activeTab === 'upload') {
      if (uploadMode === 'file') {
        if (!uploadFile) { setFormError('Select an audio file to upload.'); return }
        setPendingAction({
          mode: 'upload',
          payload: {
            file: uploadFile,
            artistId: selectedArtistId,
            albumId: selectedAlbumId,
            trackTitle: trackTitle.trim(),
            explicit,
            lyrics: uploadLyrics.trim() || undefined,
          },
          artistName,
          albumTitle,
        })
      } else {
        if (!linkUrl.trim()) { setFormError('Paste a URL to link.'); return }
        setPendingAction({
          mode: 'link',
          payload: {
            storageUrl: linkUrl.trim(),
            artistId: selectedArtistId,
            albumId: selectedAlbumId,
            trackTitle: trackTitle.trim(),
            explicit,
            lyrics: uploadLyrics.trim() || undefined,
          },
          artistName,
          albumTitle,
        })
      }
    } else {
      if (!prompt.trim()) { setFormError('Song prompt is required.'); return }
      const weightedPrompts = styleNote.trim()
        ? [{ text: styleNote.trim(), weight: 0.85 }]
        : undefined

      setPendingAction({
        mode: 'generate',
        params: {
          artistId: selectedArtistId,
          albumId: selectedAlbumId,
          trackTitle: trackTitle.trim(),
          explicit,
          prompt: prompt.trim(),
          promptWeight: 1,
          weightedPrompts,
          negativePrompt: negativePrompt.trim() || undefined,
          lengthSeconds: parseOptionalInt(lengthSeconds) ?? 150,
          fileName: fileName.trim() || undefined,
          seed: parseOptionalInt(seed),
          forceInstrumental,
          lyrics: useCustomLyrics && !forceInstrumental ? lyrics.trim() || undefined : undefined,
          lyricsLanguage: 'en',
          withTimestamps,
          outputFormat: 'mp3_44100_128',
        },
        artistName,
        albumTitle,
      })
    }
  }

  function handleConfirm() {
    if (!pendingAction) return
    if (pendingAction.mode === 'generate') createMusicMutation.mutate(pendingAction.params)
    else if (pendingAction.mode === 'upload') uploadMutation.mutate(pendingAction.payload)
    else linkMutation.mutate(pendingAction.payload)
  }

  function handleEdit() {
    setPendingAction(null)
    createMusicMutation.reset()
    uploadMutation.reset()
    linkMutation.reset()
  }

  const activeMutation =
    pendingAction?.mode === 'generate' ? createMusicMutation :
    pendingAction?.mode === 'upload'   ? uploadMutation :
    linkMutation

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-6">

      {/* ── Success banner ──────────────────────────────────────────────── */}
      {successTitle && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          <strong>{successTitle}</strong> submitted to staging. A reviewer will publish it shortly.
        </div>
      )}

      {/* ── No-artists warning ──────────────────────────────────────────── */}
      {noArtists && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          No artists available yet. Go to the <strong>Artists</strong> tab to create one first.
        </div>
      )}

      {/* ── Preview / confirm card ───────────────────────────────────────── */}
      {pendingAction && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-5 space-y-4">
          <h3 className="text-base font-semibold">Review before submitting to staging</h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-fg">Track title</dt>
              <dd className="font-medium mt-0.5">
                {pendingAction.mode === 'generate'
                  ? pendingAction.params.trackTitle
                  : pendingAction.payload.trackTitle}
              </dd>
            </div>
            <div>
              <dt className="text-muted-fg">Artist</dt>
              <dd className="mt-0.5">{pendingAction.artistName}</dd>
            </div>
            <div>
              <dt className="text-muted-fg">Album</dt>
              <dd className="mt-0.5">{pendingAction.albumTitle}</dd>
            </div>
            <div>
              <dt className="text-muted-fg">Explicit</dt>
              <dd className="mt-0.5">
                {(pendingAction.mode === 'generate'
                  ? pendingAction.params.explicit
                  : pendingAction.payload.explicit)
                  ? 'Yes' : 'No'}
              </dd>
            </div>

            {pendingAction.mode === 'generate' && (
              <>
                <div className="md:col-span-2">
                  <dt className="text-muted-fg">Prompt</dt>
                  <dd className="mt-0.5 line-clamp-3">{pendingAction.params.prompt}</dd>
                </div>
                <div>
                  <dt className="text-muted-fg">Length</dt>
                  <dd className="mt-0.5">{pendingAction.params.lengthSeconds}s</dd>
                </div>
                {pendingAction.params.forceInstrumental && (
                  <div>
                    <dt className="text-muted-fg">Mode</dt>
                    <dd className="mt-0.5">Instrumental only</dd>
                  </div>
                )}
                {pendingAction.params.negativePrompt && (
                  <div className="md:col-span-2">
                    <dt className="text-muted-fg">Negative prompt</dt>
                    <dd className="mt-0.5 text-muted-fg text-xs">{pendingAction.params.negativePrompt}</dd>
                  </div>
                )}
              </>
            )}

            {pendingAction.mode === 'upload' && (
              <div className="md:col-span-2">
                <dt className="text-muted-fg">File</dt>
                <dd className="mt-0.5 text-xs text-muted-fg">
                  {pendingAction.payload.file.name}
                  {' '}({(pendingAction.payload.file.size / 1024 / 1024).toFixed(2)} MB)
                </dd>
              </div>
            )}

            {pendingAction.mode === 'link' && (
              <div className="md:col-span-2">
                <dt className="text-muted-fg">Audio URL</dt>
                <dd className="mt-0.5 text-xs text-muted-fg truncate">{pendingAction.payload.storageUrl}</dd>
              </div>
            )}
          </dl>

          {activeMutation.error && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {asErrorMessage(
                activeMutation.error,
                pendingAction.mode === 'generate' ? 'Song generation failed.' : 'Submission failed.',
              )}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={activeMutation.isPending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60"
            >
              {activeMutation.isPending
                ? (pendingAction.mode === 'generate' ? 'Generating…' : 'Submitting…')
                : (pendingAction.mode === 'generate' ? 'Confirm & Generate' : 'Submit to staging')}
            </button>
            <button
              type="button"
              onClick={handleEdit}
              disabled={activeMutation.isPending}
              className="studio-outline-button rounded-md px-4 py-2 text-sm disabled:opacity-60"
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {/* ── Create form ─────────────────────────────────────────────────── */}
      {!pendingAction && (
        <form
          onSubmit={handlePreview}
          className="studio-card grid grid-cols-1 gap-4 rounded-[26px] p-5 lg:grid-cols-3"
        >
          <h3 className="text-base font-semibold lg:col-span-3">New song</h3>

          {/* ── Catalog linking ──────────────────────────────────────── */}
          <label className="text-sm">
            Artist <span className="text-accent">*</span>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              value={selectedArtistId}
              onChange={(e) => setSelectedArtistId(e.target.value)}
              required
              disabled={!controlsEnabled || artistsQuery.isLoading}
            >
              <option value="">— select artist —</option>
              {selectableArtists.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.status === 'review' ? ' (staging)' : ''}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Album <span className="text-accent">*</span>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              value={selectedAlbumId}
              onChange={(e) => setSelectedAlbumId(e.target.value)}
              required
              disabled={!controlsEnabled || !selectedArtistId || albumsQuery.isLoading}
            >
              <option value="">— select album —</option>
              {albumsForArtist.map((a) => (
                <option key={a.id} value={a.id}>{a.title}{a.status === 'review' ? ' (staging)' : ''}</option>
              ))}
            </select>
            {!selectedArtistId && <p className="mt-1 text-xs text-muted-fg">Select an artist first.</p>}
            {noAlbums && (
              <p className="mt-1 text-xs text-amber-300">
                No albums for this artist. Add one in the <strong>Albums</strong> tab.
              </p>
            )}
          </label>

          <label className="text-sm">
            Track title <span className="text-accent">*</span>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 disabled:opacity-50"
              value={trackTitle}
              onChange={(e) => setTrackTitle(e.target.value)}
              placeholder="e.g. Midnight Circuit"
              required
              disabled={!controlsEnabled}
            />
          </label>

          {/* ── Tab switcher ─────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 lg:col-span-3">
            {(['song', 'lyrics', 'upload'] as CreatorTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`rounded-md px-3 py-2 text-sm capitalize
                  ${activeTab === tab ? 'bg-accent text-accent-fg' : 'studio-outline-button'}
                  ${tab === 'lyrics' && forceInstrumental ? 'opacity-40 cursor-not-allowed' : ''}`}
                onClick={() => tab === 'lyrics' && forceInstrumental ? null : setActiveTab(tab)}
                disabled={!controlsEnabled}
              >
                {tab === 'upload' ? 'Upload / Link' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* ── Song tab ─────────────────────────────────────────────── */}
          {activeTab === 'song' && (
            <>
              <label className="text-sm lg:col-span-3">
                Song prompt <span className="text-accent">*</span>
                <textarea
                  className="mt-1 min-h-28 w-full rounded-md border border-border bg-background px-3 py-2"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Dream-pop duet with a soaring female lead, wide choruses, emotional build, midnight city energy..."
                  required={activeTab === 'song'}
                  disabled={!controlsEnabled}
                />
              </label>

              <label className="text-sm lg:col-span-2">
                Extra style note <span className="text-muted-fg">(optional)</span>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  value={styleNote}
                  onChange={(e) => setStyleNote(e.target.value)}
                  placeholder="Warm analog synths, live drums, glossy hook"
                  disabled={!controlsEnabled}
                />
              </label>
              <label className="text-sm">
                Negative prompt <span className="text-muted-fg">(optional)</span>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="No trap hats, no harsh distortion"
                  disabled={!controlsEnabled}
                />
              </label>

              <label className="text-sm">
                Length (seconds)
                <input
                  type="number"
                  min={3} max={600}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  value={lengthSeconds}
                  onChange={(e) => setLengthSeconds(e.target.value)}
                  disabled={!controlsEnabled}
                />
              </label>
              <label className="text-sm">
                File name hint <span className="text-muted-fg">(optional)</span>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="midnight-heartbreak"
                  disabled={!controlsEnabled}
                />
              </label>
              <label className="text-sm">
                Seed <span className="text-muted-fg">(optional)</span>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="42"
                  disabled={!controlsEnabled}
                />
              </label>

              <div className="flex flex-wrap gap-6 lg:col-span-3">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} disabled={!controlsEnabled} />
                  Explicit content
                </label>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={forceInstrumental} onChange={(e) => setForceInstrumental(e.target.checked)} disabled={!controlsEnabled} />
                  Instrumental only
                </label>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={withTimestamps} onChange={(e) => setWithTimestamps(e.target.checked)} disabled={!controlsEnabled} />
                  Return word timestamps
                </label>
              </div>
            </>
          )}

          {/* ── Lyrics tab ────────────────────────────────────────────── */}
          {activeTab === 'lyrics' && (
            <>
              <label className="inline-flex items-center gap-2 text-sm lg:col-span-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomLyrics}
                  onChange={(e) => setUseCustomLyrics(e.target.checked)}
                  disabled={!controlsEnabled || forceInstrumental}
                />
                Provide custom lyrics for the vocal sections
              </label>

              {forceInstrumental && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 lg:col-span-3">
                  Instrumental mode is on — lyrics are disabled. Turn it off in the Song tab.
                </p>
              )}

              {!forceInstrumental && useCustomLyrics && (
                <label className="text-sm lg:col-span-3">
                  Lyrics
                  <textarea
                    className="mt-1 min-h-72 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    placeholder={`[Verse 1]\nStreetlights ripple on the glass\nI keep your name behind my teeth\n\n[Chorus]\nMeet me where the skyline shakes\nSing me into morning`}
                    disabled={!controlsEnabled}
                  />
                </label>
              )}

              {!forceInstrumental && !useCustomLyrics && (
                <p className="studio-readonly rounded-2xl px-3 py-2 text-sm text-muted-fg lg:col-span-3">
                  Leave this off to let ElevenLabs improvise vocals from your song prompt.
                </p>
              )}
            </>
          )}

          {/* ── Upload / Link tab ─────────────────────────────────────── */}
          {activeTab === 'upload' && (
            <>
              {/* Mode toggle */}
              <div className="flex gap-2 lg:col-span-3">
                {(['file', 'url'] as UploadMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-sm ${uploadMode === mode ? 'bg-accent text-accent-fg' : 'studio-outline-button'}`}
                    onClick={() => setUploadMode(mode)}
                    disabled={!controlsEnabled}
                  >
                    {mode === 'file' ? 'Upload file' : 'Link external URL'}
                  </button>
                ))}
              </div>

              {uploadMode === 'file' && (
                <label className="text-sm lg:col-span-2">
                  Audio file <span className="text-accent">*</span>
                  <input
                    type="file"
                    accept={ACCEPTED_AUDIO}
                    className="mt-1 block w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:font-medium file:text-accent-fg disabled:opacity-50"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    disabled={!controlsEnabled}
                  />
                  {uploadFile && (
                    <p className="mt-1 text-xs text-muted-fg">
                      {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </label>
              )}

              {uploadMode === 'url' && (
                <label className="text-sm lg:col-span-2">
                  Audio URL <span className="text-accent">*</span>
                  <input
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 disabled:opacity-50"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://cdn.example.com/track.mp3  or  data/generated/music/track.mp3"
                    disabled={!controlsEnabled}
                  />
                  <p className="mt-1 text-xs text-muted-fg">
                    Supported formats: mp3, m4a, wav, flac, ogg, opus, aac. Format is inferred from the file extension.
                  </p>
                </label>
              )}

              <label className="inline-flex items-center gap-2 text-sm self-end cursor-pointer">
                <input type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} disabled={!controlsEnabled} />
                Explicit content
              </label>

              <label className="text-sm lg:col-span-3">
                Lyrics <span className="text-muted-fg">(optional)</span>
                <textarea
                  className="mt-1 min-h-40 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                  value={uploadLyrics}
                  onChange={(e) => setUploadLyrics(e.target.value)}
                  placeholder={`[Verse 1]\nStreetlights ripple on the glass\nI keep your name behind my teeth\n\n[Chorus]\nMeet me where the skyline shakes\nSing me into morning`}
                  disabled={!controlsEnabled}
                />
              </label>
            </>
          )}

          {/* ── Form-level error ──────────────────────────────────────── */}
          {formError && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 lg:col-span-3">
              {formError}
            </p>
          )}

          <div className="lg:col-span-3">
            <button
              type="submit"
              disabled={!controlsEnabled || !selectedArtistId || !selectedAlbumId || !trackTitle.trim()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60"
            >
              Preview &amp; Submit
            </button>
          </div>
        </form>
      )}

      {/* ── Generation job history ───────────────────────────────────────── */}
      <div className="studio-table-card rounded-[24px]">
        <div className="studio-divider studio-table-head border-b px-4 py-3 text-sm text-muted-fg">
          Recent generated files ({jobs.data?.total ?? 0})
        </div>

        {jobs.isLoading && (
          <p className="px-4 py-3 text-sm text-muted-fg">Loading generation history…</p>
        )}

        {!jobs.isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="studio-table-head">
                <tr>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Song</th>
                  <th className="px-3 py-2 text-left">Duration</th>
                  <th className="px-3 py-2 text-left">File</th>
                  <th className="px-3 py-2 text-left">Size</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-left">Preview</th>
                </tr>
              </thead>
              <tbody>
                {(jobs.data?.items ?? []).map((job) => (
                  <tr key={job.id} className="studio-table-row border-t align-top">
                    <td className="px-3 py-2">{job.status}</td>
                    <td className="max-w-md px-3 py-2">
                      <p className="font-medium">{getSongTitle(job) || job.prompt || '-'}</p>
                      {job.prompt && getSongTitle(job) && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-fg">{job.prompt}</p>
                      )}
                      {job.errorMessage && (
                        <p className="mt-1 text-xs text-red-300">{job.errorMessage}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">{formatDuration(job)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-fg">{job.outputStorageUrl || '-'}</td>
                    <td className="px-3 py-2">{formatFileSize(job)}</td>
                    <td className="px-3 py-2 text-muted-fg">{formatDate(job.createdAt)}</td>
                    <td className="px-3 py-2">
                      {job.outputStorageUrl ? (
                        <button
                          className="studio-outline-button rounded-md px-2 py-1 text-xs disabled:opacity-60"
                          disabled={previewMutation.isPending}
                          onClick={() => previewMutation.mutate(job)}
                        >
                          Preview
                        </button>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {previewError && (
          <div className="studio-divider border-t px-4 py-3">
            <p className="text-sm text-red-300">{previewError}</p>
          </div>
        )}

        {previewUrl && (
          <div className="studio-divider space-y-3 border-t px-4 py-3">
            <div>
              <p className="text-xs text-muted-fg">Previewing job {previewJobId}</p>
              {previewTitle && <p className="mt-1 text-sm font-medium">{previewTitle}</p>}
            </div>
            <audio controls src={previewUrl} className="w-full" />
            {previewLyrics && (
              <div className="studio-readonly rounded-2xl p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-fg">Lyrics</p>
                <pre className="whitespace-pre-wrap text-sm text-foreground">{previewLyrics}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Song catalog browse ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold">Song catalog</h3>
        <div className="studio-card rounded-[24px] grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
          <label className="text-sm">
            Search
            <input
              className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="title or slug"
            />
          </label>
          <label className="text-sm">
            Status
            <select
              className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
              value={catalogStatusFilter}
              onChange={(e) => setCatalogStatusFilter(e.target.value as ContentStatus | 'all')}
            >
              <option value="all">All</option>
              <option value="review">Staging</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="text-sm">
            Artist
            <select
              className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
              value={catalogArtistFilter}
              onChange={(e) => setCatalogArtistFilter(e.target.value)}
            >
              <option value="all">All artists</option>
              {(artistsQuery.data?.items ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <div className="text-sm flex items-end text-muted-fg">
            {tracksQuery.data?.total ?? 0} song{(tracksQuery.data?.total ?? 0) !== 1 ? 's' : ''}
          </div>
        </div>

        {tracksQuery.isLoading && <p className="text-sm text-muted-fg">Loading…</p>}

        {!tracksQuery.isLoading && (tracksQuery.data?.items ?? []).length > 0 && (
          <div className="studio-table-card rounded-[24px] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="studio-table-head text-left">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Artist</th>
                  <th className="px-3 py-2">Album</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Updated</th>
                  {isAdmin && <th className="px-3 py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {(tracksQuery.data?.items ?? []).map((track: TrackItem) => (
                  <tr key={track.id} className="studio-table-row border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium">{track.title}</p>
                      {track.explicit && (
                        <span className="text-xs text-amber-400">E</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{track.primaryArtistName}</td>
                    <td className="px-3 py-2 text-muted-fg">{track.albumTitle}</td>
                    <td className="px-3 py-2 tabular-nums">{formatTrackDuration(track.durationMs)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={track.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-fg">
                      {new Date(track.updatedAt).toLocaleString()}
                    </td>
                    {/* Songs are fully immutable — admin can only revoke published tracks */}
                    {isAdmin && (
                      <td className="px-3 py-2">
                        {track.status === 'published' && (
                          <button
                            onClick={() => { setRevokeTarget(track); setRevokeNotes(''); revokeMutation.reset() }}
                            className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!tracksQuery.isLoading && (tracksQuery.data?.items ?? []).length === 0 && (
          <p className="text-sm text-muted-fg">No songs found.</p>
        )}
      </div>

      {/* ── Track revoke confirmation (admin-only) ───────────────────────────── */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="studio-modal-card w-full max-w-md rounded-[28px] ring-1 ring-inset ring-danger/20">
            <div className="p-5 space-y-4">
              <h2 className="text-base font-semibold text-red-300">Revoke published song</h2>
              <p className="text-sm text-foreground">
                <strong>{revokeTarget.title}</strong> will be unpublished and moved back to staging.
                Songs are immutable — no edits can be made while in staging.
                A reviewer must re-approve it before it appears on the platform again.
              </p>
              <label className="text-sm">
                Reason <span className="text-muted-fg">(optional — notifies the creator)</span>
                <textarea
                  className="mt-1 w-full rounded-md bg-surface border border-border px-3 py-2 min-h-20 resize-y"
                  value={revokeNotes}
                  onChange={(e) => setRevokeNotes(e.target.value)}
                  placeholder="e.g. Audio quality issue requires re-upload"
                />
              </label>

              {revokeMutation.error && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {asErrorMessage(revokeMutation.error, 'Failed to revoke track.')}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => revokeMutation.mutate({ id: revokeTarget.id, notes: revokeNotes })}
                  disabled={revokeMutation.isPending}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-red-700"
                >
                  {revokeMutation.isPending ? 'Revoking…' : 'Confirm revoke'}
                </button>
                <button
                  onClick={() => { setRevokeTarget(null); setRevokeNotes(''); revokeMutation.reset() }}
                  disabled={revokeMutation.isPending}
                  className="studio-outline-button rounded-md px-4 py-2 text-sm disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  )
}
