/**
 * CreateAlbumPanel — create new albums and browse the existing album catalog.
 *
 * Albums require an artist to be linked (hierarchy enforcement). The artist
 * selector lists all artists regardless of status so that a newly staged artist
 * can immediately have albums assigned to it.
 *
 * Flow: fill form → Preview & Submit → confirmation card → submit to staging.
 */
import type { AxiosError } from 'axios'
import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAlbum, listAlbums, listArtists, listGenres } from '../services/internal'
import type { AlbumItem, AlbumType, ContentStatus } from '../types'
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

const ALBUM_TYPES: AlbumType[] = ['album', 'single', 'ep', 'compilation']

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

interface AlbumDraft {
  title: string
  slug: string
  artistId: string
  albumType: AlbumType
  releaseDate: string
  coverUrl: string
  description: string
  genreIds: string[]
}

const EMPTY_DRAFT: AlbumDraft = {
  title: '', slug: '', artistId: '', albumType: 'album',
  releaseDate: '', coverUrl: '', description: '', genreIds: [],
}

export default function CreateAlbumPanel() {
  const queryClient = useQueryClient()

  const [draft, setDraft] = useState<AlbumDraft>(EMPTY_DRAFT)
  const [formError, setFormError] = useState<string | null>(null)
  const [preview, setPreview] = useState<AlbumDraft | null>(null)
  const [successTitle, setSuccessTitle] = useState<string | null>(null)

  // Catalog browse
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all')
  const [artistFilter, setArtistFilter] = useState<string>('all')

  const genres = useQuery({ queryKey: ['genres'], queryFn: listGenres })

  // All artists for the create form selector
  const artistOptions = useQuery({
    queryKey: ['artists-options'],
    queryFn: () => listArtists({ limit: 200 }),
  })

  const albums = useQuery({
    queryKey: ['albums', statusFilter, artistFilter, search],
    queryFn: () => listAlbums({
      limit: 100,
      status: statusFilter === 'all' ? undefined : statusFilter,
      artistId: artistFilter === 'all' ? undefined : artistFilter,
      q: search.trim() || undefined,
    }),
  })

  const createMutation = useMutation({
    mutationFn: createAlbum,
    onSuccess: (album) => {
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      queryClient.invalidateQueries({ queryKey: ['albums-options'] })
      setSuccessTitle(album.title)
      setPreview(null)
      setDraft(EMPTY_DRAFT)
      setFormError(null)
    },
  })

  function set(key: keyof AlbumDraft) {
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
    if (!draft.artistId) {
      setFormError('Select an artist for this album.')
      return
    }
    if (!draft.title.trim()) {
      setFormError('Album title is required.')
      return
    }
    setSuccessTitle(null)
    setPreview({ ...draft })
  }

  function handleConfirm() {
    if (!preview) return
    createMutation.mutate({
      title: preview.title.trim(),
      slug: preview.slug.trim() || undefined,
      artistId: preview.artistId,
      coverUrl: preview.coverUrl.trim() || undefined,
      description: preview.description.trim() || undefined,
      releaseDate: preview.releaseDate || undefined,
      albumType: preview.albumType,
      genreIds: preview.genreIds,
    })
  }

  const genreList = genres.data ?? []
  const genreMap = Object.fromEntries(genreList.map((g) => [g.id, g.name]))
  const allArtists = artistOptions.data?.items ?? []
  const artistMap = Object.fromEntries(allArtists.map((a) => [a.id, a.name]))

  return (
    <section className="space-y-6">

      {/* ── Success banner ──────────────────────────────────────────────────── */}
      {successTitle && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          <strong>{successTitle}</strong> submitted to staging. A reviewer will publish it shortly.
        </div>
      )}

      {/* ── Preview / confirm step ──────────────────────────────────────────── */}
      {preview && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-5 space-y-4">
          <h3 className="text-base font-semibold">Review before submitting to staging</h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-fg">Title</dt>
              <dd className="font-medium mt-0.5">{preview.title}</dd>
            </div>
            <div>
              <dt className="text-muted-fg">Artist</dt>
              <dd className="mt-0.5">{artistMap[preview.artistId] ?? preview.artistId}</dd>
            </div>
            <div>
              <dt className="text-muted-fg">Type</dt>
              <dd className="mt-0.5 capitalize">{preview.albumType}</dd>
            </div>
            {preview.releaseDate && (
              <div>
                <dt className="text-muted-fg">Release date</dt>
                <dd className="mt-0.5">{preview.releaseDate}</dd>
              </div>
            )}
            {preview.coverUrl && (
              <div className="md:col-span-2">
                <dt className="text-muted-fg">Cover art</dt>
                <dd className="mt-0.5 truncate text-xs text-muted-fg">{preview.coverUrl}</dd>
              </div>
            )}
            {preview.description && (
              <div className="md:col-span-2">
                <dt className="text-muted-fg">Description</dt>
                <dd className="mt-0.5 line-clamp-3">{preview.description}</dd>
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
              {asErrorMessage(createMutation.error, 'Failed to create album.')}
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
          <h3 className="text-base font-semibold">New album</h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <label className="text-sm">
              Title <span className="text-accent">*</span>
              <input
                className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                value={draft.title}
                onChange={set('title')}
                required
              />
            </label>
            <label className="text-sm">
              Slug <span className="text-muted-fg">(auto-generated if blank)</span>
              <input
                className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                value={draft.slug}
                onChange={set('slug')}
              />
            </label>
            <label className="text-sm">
              Artist <span className="text-accent">*</span>
              <select
                className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                value={draft.artistId}
                onChange={set('artistId')}
                required
              >
                <option value="">Select artist…</option>
                {allArtists.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Type
              <select
                className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                value={draft.albumType}
                onChange={set('albumType')}
              >
                {ALBUM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="text-sm">
              Release date
              <input
                type="date"
                className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
                value={draft.releaseDate}
                onChange={set('releaseDate')}
              />
            </label>
            <div>
              <ImageInput
                label="Cover art"
                value={draft.coverUrl}
                onChange={(url) => setDraft((d) => ({ ...d, coverUrl: url }))}
                placeholder="data/images/cover.jpg  or  https://..."
              />
            </div>
            <label className="text-sm lg:col-span-2">
              Description
              <textarea
                className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2 min-h-24 resize-y"
                value={draft.description}
                onChange={set('description')}
              />
            </label>
            <label className="text-sm lg:col-span-2">
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
        <h3 className="text-base font-semibold">Album catalog</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-lg border border-border bg-surface/40">
          <label className="text-sm">
            Search
            <input
              className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="title or slug"
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
          <label className="text-sm">
            Artist
            <select
              className="mt-1 w-full rounded-md bg-background border border-border px-3 py-2"
              value={artistFilter}
              onChange={(e) => setArtistFilter(e.target.value)}
            >
              <option value="all">All artists</option>
              {allArtists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <div className="text-sm flex items-end text-muted-fg">
            {albums.data?.total ?? 0} album{(albums.data?.total ?? 0) !== 1 ? 's' : ''}
          </div>
        </div>

        {albums.isLoading && <p className="text-sm text-muted-fg">Loading…</p>}

        {!albums.isLoading && (albums.data?.items ?? []).length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface/70 text-left">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Artist</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Tracks</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {(albums.data?.items ?? []).map((album: AlbumItem) => (
                  <tr key={album.id} className="border-t border-border/60">
                    <td className="px-3 py-2">
                      <p className="font-medium">{album.title}</p>
                      <p className="text-xs text-muted-fg">{album.slug}</p>
                    </td>
                    <td className="px-3 py-2">{album.artistName}</td>
                    <td className="px-3 py-2 capitalize text-muted-fg">{album.albumType}</td>
                    <td className="px-3 py-2 tabular-nums">{album.trackCount}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={album.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-fg">
                      {new Date(album.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!albums.isLoading && (albums.data?.items ?? []).length === 0 && (
          <p className="text-sm text-muted-fg">No albums found.</p>
        )}
      </div>
    </section>
  )
}
