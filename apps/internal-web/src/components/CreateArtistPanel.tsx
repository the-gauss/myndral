/**
 * CreateArtistPanel — create new artists and browse the existing artist catalog.
 *
 * Flow: fill form → Preview & Submit → confirmation card → submit to staging.
 * All created artists go directly to status='review'; status transitions happen
 * exclusively through staging endpoints.
 */
import type { AxiosError } from 'axios'
import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createArtist, listArtists, listGenres } from '../services/internal'
import type { ArtistItem, ContentStatus } from '../types'
import ImageInput from './ImageInput'

function asErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ detail?: unknown }>
  const detail = axiosError?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  if (Array.isArray(detail) && detail.length > 0) {
    const first = (detail[0] as { msg?: string })?.msg
    return first ? `Validation error: ${first}` : fallback
  }
  return fallback
}

function parseCsv(raw: string): string[] {
  return raw.split(',').map((v) => v.trim()).filter(Boolean)
}

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

interface ArtistDraft {
  name: string
  slug: string
  bio: string
  imageUrl: string
  headerImageUrl: string
  personaPrompt: string
  styleTags: string
  genreIds: string[]
}

const EMPTY_DRAFT: ArtistDraft = {
  name: '', slug: '', bio: '', imageUrl: '', headerImageUrl: '',
  personaPrompt: '', styleTags: '', genreIds: [],
}

export default function CreateArtistPanel() {
  const queryClient = useQueryClient()

  // Form state
  const [draft, setDraft] = useState<ArtistDraft>(EMPTY_DRAFT)
  const [formError, setFormError] = useState<string | null>(null)
  // Preview step: null = form, non-null = preview before submit
  const [preview, setPreview] = useState<ArtistDraft | null>(null)
  const [successName, setSuccessName] = useState<string | null>(null)

  // Catalog browse
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all')

  const genres = useQuery({ queryKey: ['genres'], queryFn: listGenres })

  const artists = useQuery({
    queryKey: ['artists', statusFilter, search],
    queryFn: () => listArtists({
      limit: 100,
      status: statusFilter === 'all' ? undefined : statusFilter,
      q: search.trim() || undefined,
    }),
  })

  const createMutation = useMutation({
    mutationFn: createArtist,
    onSuccess: (artist) => {
      queryClient.invalidateQueries({ queryKey: ['artists'] })
      queryClient.invalidateQueries({ queryKey: ['artists-options'] })
      setSuccessName(artist.name)
      setPreview(null)
      setDraft(EMPTY_DRAFT)
      setFormError(null)
    },
  })

  function set(key: keyof ArtistDraft) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setDraft((d) => ({ ...d, [key]: e.target.value }))
    }
  }

  function handleGenreChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setDraft((d) => ({ ...d, genreIds: Array.from(e.target.selectedOptions).map((o) => o.value) }))
  }

  function handlePreview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    if (!draft.name.trim()) {
      setFormError('Artist name is required.')
      return
    }
    setSuccessName(null)
    setPreview({ ...draft })
  }

  function handleConfirm() {
    if (!preview) return
    createMutation.mutate({
      name: preview.name.trim(),
      slug: preview.slug.trim() || undefined,
      bio: preview.bio.trim() || undefined,
      imageUrl: preview.imageUrl.trim() || undefined,
      headerImageUrl: preview.headerImageUrl.trim() || undefined,
      personaPrompt: preview.personaPrompt.trim() || undefined,
      styleTags: parseCsv(preview.styleTags),
      genreIds: preview.genreIds,
    })
  }

  const genreList = genres.data ?? []
  const genreMap = Object.fromEntries(genreList.map((g) => [g.id, g.name]))

  return (
    <section className="space-y-6">

      {/* ── Success banner ──────────────────────────────────────────────────── */}
      {successName && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          <strong>{successName}</strong> submitted to staging. A reviewer will publish it shortly.
        </div>
      )}

      {/* ── Preview / confirm step ──────────────────────────────────────────── */}
      {preview && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-5 space-y-4">
          <h3 className="text-base font-semibold">Review before submitting to staging</h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-fg">Name</dt>
              <dd className="font-medium mt-0.5">{preview.name}</dd>
            </div>
            {preview.slug && (
              <div>
                <dt className="text-muted-fg">Slug</dt>
                <dd className="mt-0.5">{preview.slug}</dd>
              </div>
            )}
            {preview.bio && (
              <div className="md:col-span-2">
                <dt className="text-muted-fg">Bio</dt>
                <dd className="mt-0.5 line-clamp-3">{preview.bio}</dd>
              </div>
            )}
            {preview.imageUrl && (
              <div>
                <dt className="text-muted-fg">Portrait image</dt>
                <dd className="mt-0.5 truncate text-xs text-muted-fg">{preview.imageUrl}</dd>
              </div>
            )}
            {preview.styleTags && (
              <div>
                <dt className="text-muted-fg">Style tags</dt>
                <dd className="mt-0.5">{parseCsv(preview.styleTags).join(', ') || '—'}</dd>
              </div>
            )}
            {preview.genreIds.length > 0 && (
              <div>
                <dt className="text-muted-fg">Genres</dt>
                <dd className="mt-0.5">{preview.genreIds.map((id) => genreMap[id] ?? id).join(', ')}</dd>
              </div>
            )}
          </dl>

          {createMutation.error && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {asErrorMessage(createMutation.error, 'Failed to create artist.')}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleConfirm}
              disabled={createMutation.isPending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60"
            >
              {createMutation.isPending ? 'Submitting…' : 'Submit to staging'}
            </button>
            <button
              onClick={() => { setPreview(null); createMutation.reset() }}
              disabled={createMutation.isPending}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface disabled:opacity-60"
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {/* ── Create form ─────────────────────────────────────────────────────── */}
      {!preview && (
        <form onSubmit={handlePreview} className="rounded-lg border border-border bg-surface/40 p-5 space-y-4">
          <h3 className="text-base font-semibold">New artist</h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <label className="text-sm">
              Name <span className="text-accent">*</span>
              <input
                className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                value={draft.name}
                onChange={set('name')}
                required
              />
            </label>
            <label className="text-sm">
              Slug <span className="text-muted-fg">(auto-generated if blank)</span>
              <input
                className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                value={draft.slug}
                onChange={set('slug')}
                placeholder="e.g. solar-echo"
              />
            </label>
            <div>
              <ImageInput
                label="Portrait image"
                value={draft.imageUrl}
                onChange={(url) => setDraft((d) => ({ ...d, imageUrl: url }))}
                placeholder="data/images/artist.jpg  or  https://..."
              />
            </div>
            <div>
              <ImageInput
                label="Header image (optional)"
                value={draft.headerImageUrl}
                onChange={(url) => setDraft((d) => ({ ...d, headerImageUrl: url }))}
                placeholder="data/images/artist-header.jpg"
              />
            </div>
            <label className="text-sm lg:col-span-2">
              Bio
              <textarea
                className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2 min-h-24 resize-y"
                value={draft.bio}
                onChange={set('bio')}
              />
            </label>
            <label className="text-sm lg:col-span-2">
              Persona prompt <span className="text-muted-fg">(AI generation context, optional)</span>
              <textarea
                className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2 min-h-20 resize-y"
                value={draft.personaPrompt}
                onChange={set('personaPrompt')}
              />
            </label>
            <label className="text-sm">
              Style tags <span className="text-muted-fg">(comma-separated)</span>
              <input
                className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                value={draft.styleTags}
                onChange={set('styleTags')}
                placeholder="ambient, electronic, cinematic"
              />
            </label>
            <label className="text-sm">
              Genres
              <select
                multiple
                className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2 min-h-28"
                value={draft.genreIds}
                onChange={handleGenreChange}
              >
                {genreList.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </label>
          </div>

          {formError && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {formError}
            </p>
          )}

          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg"
          >
            Preview &amp; Submit
          </button>
        </form>
      )}

      {/* ── Catalog browse ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold">Artist catalog</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-lg border border-border bg-surface/40">
          <label className="text-sm">
            Search
            <input
              className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="name or slug"
            />
          </label>
          <label className="text-sm">
            Status
            <select
              className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ContentStatus | 'all')}
            >
              <option value="all">All</option>
              <option value="review">Staging</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <div className="text-sm flex items-end text-muted-fg">
            {artists.data?.total ?? 0} artist{(artists.data?.total ?? 0) !== 1 ? 's' : ''}
          </div>
        </div>

        {artists.isLoading && <p className="text-sm text-muted-fg">Loading…</p>}

        {!artists.isLoading && (artists.data?.items ?? []).length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface/70 text-left">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Portrait</th>
                  <th className="px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {(artists.data?.items ?? []).map((artist: ArtistItem) => (
                  <tr key={artist.id} className="border-t border-border/60">
                    <td className="px-3 py-2">
                      <p className="font-medium">{artist.name}</p>
                      <p className="text-xs text-muted-fg">{artist.slug}</p>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={artist.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-fg">
                      {artist.imageUrl ? 'Configured' : 'Missing'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-fg">
                      {new Date(artist.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!artists.isLoading && (artists.data?.items ?? []).length === 0 && (
          <p className="text-sm text-muted-fg">No artists found.</p>
        )}
      </div>
    </section>
  )
}
