import type { AxiosError } from 'axios'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchGeneratedMusicFile,
  generateMusic,
  listAlbums,
  listArtists,
  listMusicJobs,
} from '../services/internal'
import type { ArtistItem, AlbumItem, MusicGenerationJob } from '../types'

type CreatorTab = 'song' | 'lyrics'

function parseOptionalNumber(raw: string): number | undefined {
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

function parseOptionalInt(raw: string): number | undefined {
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function asErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ detail?: unknown }>
  const detail = axiosError?.response?.data?.detail
  // FastAPI HTTPException: detail is a plain string
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  // FastAPI 422 validation error: detail is an array of {msg, loc, type}
  if (Array.isArray(detail) && detail.length > 0) {
    const first = (detail[0] as { msg?: string })?.msg
    return first ? `Validation error: ${first}` : fallback
  }
  // Fallback: if the proxy returned a plain-text body (not HTML)
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
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }
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

export default function CreateMusicPanel() {
  const queryClient = useQueryClient()

  // ── Catalog linking ─────────────────────────────────────────────────────
  const [selectedArtistId, setSelectedArtistId] = useState('')
  const [selectedAlbumId, setSelectedAlbumId] = useState('')
  const [trackTitle, setTrackTitle] = useState('')
  const [explicit, setExplicit] = useState(false)

  // ── Generation params ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<CreatorTab>('song')
  const [prompt, setPrompt] = useState('')
  const [styleNote, setStyleNote] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [lengthSeconds, setLengthSeconds] = useState('150')
  const [fileName, setFileName] = useState('')
  const [seed, setSeed] = useState('')
  const [forceInstrumental, setForceInstrumental] = useState(false)
  const [useCustomLyrics, setUseCustomLyrics] = useState(false)
  const [lyrics, setLyrics] = useState('')
  const [withTimestamps, setWithTimestamps] = useState(false)

  // ── Preview ──────────────────────────────────────────────────────────────
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewJobId, setPreviewJobId] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string | null>(null)
  const [previewLyrics, setPreviewLyrics] = useState<string | null>(null)

  // ── Catalog data ─────────────────────────────────────────────────────────
  const artistsQuery = useQuery({
    queryKey: ['internal-artists-published'],
    queryFn: () => listArtists({ status: 'published', limit: 200 }),
  })

  const albumsQuery = useQuery({
    queryKey: ['internal-albums-for-artist', selectedArtistId],
    queryFn: () => listAlbums({ artistId: selectedArtistId, limit: 200 }),
    enabled: !!selectedArtistId,
  })

  // Reset album selection when artist changes
  useEffect(() => {
    setSelectedAlbumId('')
  }, [selectedArtistId])

  useEffect(() => {
    if (forceInstrumental) {
      setUseCustomLyrics(false)
      setActiveTab('song')
    }
  }, [forceInstrumental])

  const jobs = useQuery({
    queryKey: ['music-jobs'],
    queryFn: () => listMusicJobs({ limit: 50 }),
  })

  const createMusicMutation = useMutation({
    mutationFn: generateMusic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['music-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['staging'] })
    },
  })

  const previewMutation = useMutation({
    mutationFn: async (job: MusicGenerationJob) => {
      const blob = await fetchGeneratedMusicFile(job.outputStorageUrl!)
      return { blob, jobId: job.id, title: getSongTitle(job), lyrics: getLyrics(job) }
    },
    onSuccess: ({ blob, jobId, title, lyrics: lyr }) => {
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return URL.createObjectURL(blob)
      })
      setPreviewJobId(jobId)
      setPreviewTitle(title)
      setPreviewLyrics(lyr)
    },
  })

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const controlsEnabled = useMemo(
    () => !createMusicMutation.isPending,
    [createMusicMutation.isPending],
  )

  const publishedArtists: ArtistItem[] = artistsQuery.data?.items ?? []
  const albumsForArtist: AlbumItem[] = albumsQuery.data?.items ?? []
  const noArtists = !artistsQuery.isLoading && publishedArtists.length === 0
  const noAlbums = !!selectedArtistId && !albumsQuery.isLoading && albumsForArtist.length === 0

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const weightedPrompts = styleNote.trim()
      ? [{ text: styleNote.trim(), weight: 0.85 }]
      : undefined

    createMusicMutation.mutate({
      artistId: selectedArtistId,
      albumId: selectedAlbumId,
      trackTitle: trackTitle.trim(),
      explicit,
      prompt: prompt.trim(),
      promptWeight: parseOptionalNumber('1') ?? 1,
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
    })
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-border bg-surface/40 p-4">
        <h3 className="text-lg font-semibold">Create Song (ElevenLabs)</h3>
        <p className="mt-1 text-sm text-muted-fg">
          Generate a song and link it to an artist and album. On success it moves straight to
          Staging for review.
        </p>
      </div>

      {noArtists && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          No published artists yet. Go to the <strong>Artists</strong> tab and publish at least one
          artist before generating a song.
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface/40 p-4 lg:grid-cols-3"
      >
        {/* ── Catalog linking ──────────────────────────────────────────── */}
        <label className="text-sm">
          Artist <span className="text-red-400">*</span>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            value={selectedArtistId}
            onChange={(e) => setSelectedArtistId(e.target.value)}
            required
            disabled={!controlsEnabled || artistsQuery.isLoading}
          >
            <option value="">— select artist —</option>
            {publishedArtists.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Album <span className="text-red-400">*</span>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            value={selectedAlbumId}
            onChange={(e) => setSelectedAlbumId(e.target.value)}
            required
            disabled={!controlsEnabled || !selectedArtistId || albumsQuery.isLoading}
          >
            <option value="">— select album —</option>
            {albumsForArtist.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
          {!selectedArtistId && (
            <p className="mt-1 text-xs text-muted-fg">Select an artist first.</p>
          )}
          {noAlbums && (
            <p className="mt-1 text-xs text-amber-300">
              No albums for this artist. Add one in the <strong>Albums</strong> tab.
            </p>
          )}
        </label>

        <label className="text-sm">
          Track title <span className="text-red-400">*</span>
          <input
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 disabled:opacity-50"
            value={trackTitle}
            onChange={(e) => setTrackTitle(e.target.value)}
            placeholder="e.g. Midnight Circuit"
            required
            disabled={!controlsEnabled}
          />
        </label>

        {/* ── Tab switcher ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 lg:col-span-3">
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm ${activeTab === 'song' ? 'bg-accent text-accent-fg' : 'border border-border hover:bg-surface'}`}
            onClick={() => setActiveTab('song')}
            disabled={!controlsEnabled}
          >
            Song
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm ${activeTab === 'lyrics' ? 'bg-accent text-accent-fg' : 'border border-border hover:bg-surface'} ${forceInstrumental ? 'opacity-50' : ''}`}
            onClick={() => !forceInstrumental && setActiveTab('lyrics')}
            disabled={!controlsEnabled}
          >
            Lyrics
          </button>
        </div>

        {activeTab === 'song' && (
          <>
            <label className="text-sm lg:col-span-3">
              Song prompt <span className="text-red-400">*</span>
              <textarea
                className="mt-1 min-h-28 w-full rounded-md border border-border bg-background px-3 py-2"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Dream-pop duet with a soaring female lead, wide choruses, emotional build, midnight city energy..."
                required
                disabled={!controlsEnabled}
              />
            </label>

            <label className="text-sm lg:col-span-2">
              Extra style note (optional)
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                value={styleNote}
                onChange={(e) => setStyleNote(e.target.value)}
                placeholder="Warm analog synths, live drums, glossy hook"
                disabled={!controlsEnabled}
              />
            </label>
            <label className="text-sm">
              Negative prompt (optional)
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
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                type="number"
                min={3}
                max={600}
                value={lengthSeconds}
                onChange={(e) => setLengthSeconds(e.target.value)}
                disabled={!controlsEnabled}
              />
            </label>
            <label className="text-sm">
              File name hint (optional)
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="midnight-heartbreak"
                disabled={!controlsEnabled}
              />
            </label>
            <label className="text-sm">
              Seed (optional)
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="42"
                disabled={!controlsEnabled}
              />
            </label>

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={explicit}
                onChange={(e) => setExplicit(e.target.checked)}
                disabled={!controlsEnabled}
              />
              Explicit content
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={forceInstrumental}
                onChange={(e) => setForceInstrumental(e.target.checked)}
                disabled={!controlsEnabled}
              />
              Instrumental only
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={withTimestamps}
                onChange={(e) => setWithTimestamps(e.target.checked)}
                disabled={!controlsEnabled}
              />
              Return word timestamps
            </label>
          </>
        )}

        {activeTab === 'lyrics' && (
          <>
            <label className="inline-flex items-center gap-2 text-sm lg:col-span-3">
              <input
                type="checkbox"
                checked={useCustomLyrics}
                onChange={(e) => setUseCustomLyrics(e.target.checked)}
                disabled={!controlsEnabled || forceInstrumental}
              />
              Use custom lyrics for the vocal sections
            </label>

            {forceInstrumental && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 lg:col-span-3">
                Instrumental mode disables lyrics. Turn it off in the Song tab to write vocals.
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
              <p className="rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm text-muted-fg lg:col-span-3">
                Leave this off to let ElevenLabs improvise the vocals from your song prompt.
              </p>
            )}
          </>
        )}

        {createMusicMutation.error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 lg:col-span-3">
            {asErrorMessage(createMusicMutation.error, 'Song generation failed.')}
          </p>
        )}

        {createMusicMutation.isSuccess && (
          <p className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300 lg:col-span-3">
            Song generated and sent to Staging for review.
          </p>
        )}

        <div className="lg:col-span-3">
          <button
            disabled={
              !controlsEnabled ||
              !selectedArtistId ||
              !selectedAlbumId ||
              !trackTitle.trim()
            }
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60"
          >
            {createMusicMutation.isPending ? 'Generating…' : 'Generate song'}
          </button>
        </div>
      </form>

      {/* ── Recent jobs ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border">
        <div className="border-b border-border bg-surface/70 px-4 py-3 text-sm text-muted-fg">
          Recent generated files ({jobs.data?.total ?? 0})
        </div>
        {jobs.isLoading && (
          <p className="px-4 py-3 text-sm text-muted-fg">Loading generation history...</p>
        )}
        {!jobs.isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/40">
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
                  <tr key={job.id} className="border-t border-border/60 align-top">
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
                    <td className="px-3 py-2 font-mono text-xs text-muted-fg">
                      {job.outputStorageUrl || '-'}
                    </td>
                    <td className="px-3 py-2">{formatFileSize(job)}</td>
                    <td className="px-3 py-2 text-muted-fg">{formatDate(job.createdAt)}</td>
                    <td className="px-3 py-2">
                      {job.outputStorageUrl ? (
                        <button
                          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface disabled:opacity-60"
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

        {previewUrl && (
          <div className="space-y-3 border-t border-border bg-surface/30 px-4 py-3">
            <div>
              <p className="text-xs text-muted-fg">Previewing job {previewJobId}</p>
              {previewTitle && <p className="mt-1 text-sm font-medium">{previewTitle}</p>}
            </div>
            <audio controls src={previewUrl} className="w-full" />
            {previewLyrics && (
              <div className="rounded-md border border-border/70 bg-background/60 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-fg">Lyrics</p>
                <pre className="whitespace-pre-wrap text-sm text-foreground">{previewLyrics}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
