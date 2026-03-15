/**
 * CreateAlbumPanel — create new albums and browse the existing album catalog.
 *
 * Albums require an artist to be linked (hierarchy enforcement). The artist
 * selector lists all artists regardless of status so that a newly staged artist
 * can immediately have albums assigned to it.
 *
 * Flow: fill form → Preview & Submit → confirmation card → submit to staging.
 *
 * Catalog actions (non-archived albums):
 *  - Edit: available to all roles. Title and artist are immutable after creation.
 *  - Revoke: admin-only, published albums only. Pulls the album back to staging.
 */
import type { AxiosError } from 'axios'
import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAlbum,
  listAlbums,
  listArtists,
  listGenres,
  revokeAlbum as revokeAlbumApi,
  updateAlbum,
} from '../services/internal'
import type { AlbumItem, AlbumType, ContentStatus } from '../types'
import ImageInput from './ImageInput'
import { useAuthStore } from '../store/authStore'

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

// Title and artistId are excluded — both are immutable after creation.
interface EditAlbumForm {
  slug: string
  albumType: AlbumType
  releaseDate: string
  coverUrl: string
  description: string
  genreIds: string[]
}

export default function CreateAlbumPanel() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'

  const [draft, setDraft] = useState<AlbumDraft>(EMPTY_DRAFT)
  const [formError, setFormError] = useState<string | null>(null)
  const [preview, setPreview] = useState<AlbumDraft | null>(null)
  const [successTitle, setSuccessTitle] = useState<string | null>(null)

  // Catalog browse
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all')
  const [artistFilter, setArtistFilter] = useState<string>('all')

  // Edit modal
  const [editTarget, setEditTarget] = useState<AlbumItem | null>(null)
  const [editForm, setEditForm] = useState<EditAlbumForm | null>(null)

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<AlbumItem | null>(null)
  const [revokeNotes, setRevokeNotes] = useState('')

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

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: EditAlbumForm }) =>
      updateAlbum(id, {
        slug: form.slug.trim() || undefined,
        albumType: form.albumType,
        releaseDate: form.releaseDate || undefined,
        coverUrl: form.coverUrl.trim() || undefined,
        description: form.description.trim() || undefined,
        genreIds: form.genreIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      queryClient.invalidateQueries({ queryKey: ['albums-options'] })
      setEditTarget(null)
      setEditForm(null)
    },
  })

  const revokeMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      revokeAlbumApi(id, notes.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      queryClient.invalidateQueries({ queryKey: ['staging'] })
      setRevokeTarget(null)
      setRevokeNotes('')
    },
  })

  function openEditAlbum(album: AlbumItem) {
    setEditTarget(album)
    setEditForm({
      slug: album.slug,
      albumType: album.albumType,
      releaseDate: album.releaseDate ?? '',
      coverUrl: album.coverUrl ?? '',
      description: album.description ?? '',
      genreIds: album.genreIds,
    })
    updateMutation.reset()
  }

  function closeEdit() {
    setEditTarget(null)
    setEditForm(null)
    updateMutation.reset()
  }

  function set(key: keyof AlbumDraft) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setDraft((d) => ({ ...d, [key]: e.target.value }))
    }
  }

  function handleGenreChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setDraft((d) => ({ ...d, genreIds: Array.from(e.target.selectedOptions).map((o) => o.value) }))
  }

  function handleEditGenreChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
    setEditForm((f) => f && ({ ...f, genreIds: selected }))
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
                  <th className="px-3 py-2">Actions</th>
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
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {/* Edit is available for any non-archived album */}
                        {album.status !== 'archived' && (
                          <button
                            onClick={() => openEditAlbum(album)}
                            className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                          >
                            Edit
                          </button>
                        )}
                        {/* Revoke is admin-only and only applicable to published albums */}
                        {isAdmin && album.status === 'published' && (
                          <button
                            onClick={() => { setRevokeTarget(album); setRevokeNotes(''); revokeMutation.reset() }}
                            className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
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

      {/* ── Edit album modal ────────────────────────────────────────────────── */}
      {editTarget && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">Edit album</h2>
                <p className="mt-0.5 text-xs text-muted-fg">Title and artist cannot be changed after creation.</p>
              </div>
              <button
                onClick={closeEdit}
                className="ml-4 mt-0.5 text-muted-fg hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Immutable fields — displayed read-only */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border/60 bg-surface/30 px-3 py-2 text-sm">
                  <p className="text-xs text-muted-fg mb-0.5">Title (immutable)</p>
                  <p className="font-medium">{editTarget.title}</p>
                </div>
                <div className="rounded-md border border-border/60 bg-surface/30 px-3 py-2 text-sm">
                  <p className="text-xs text-muted-fg mb-0.5">Artist (immutable)</p>
                  <p className="font-medium">{editTarget.artistName}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="text-sm">
                  Slug
                  <input
                    className="mt-1 w-full rounded-md bg-surface border border-border px-3 py-2"
                    value={editForm.slug}
                    onChange={(e) => setEditForm((f) => f && ({ ...f, slug: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  Type
                  <select
                    className="mt-1 w-full rounded-md bg-surface border border-border px-3 py-2"
                    value={editForm.albumType}
                    onChange={(e) => setEditForm((f) => f && ({ ...f, albumType: e.target.value as AlbumType }))}
                  >
                    {ALBUM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  Release date
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md bg-surface border border-border px-3 py-2"
                    value={editForm.releaseDate}
                    onChange={(e) => setEditForm((f) => f && ({ ...f, releaseDate: e.target.value }))}
                  />
                </label>
                <div>
                  <ImageInput
                    label="Cover art"
                    value={editForm.coverUrl}
                    onChange={(url) => setEditForm((f) => f && ({ ...f, coverUrl: url }))}
                    placeholder="data/images/cover.jpg  or  https://..."
                  />
                </div>
                <label className="text-sm lg:col-span-2">
                  Description
                  <textarea
                    className="mt-1 w-full rounded-md bg-surface border border-border px-3 py-2 min-h-24 resize-y"
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => f && ({ ...f, description: e.target.value }))}
                  />
                </label>
                <label className="text-sm lg:col-span-2">
                  Genres
                  <select
                    multiple
                    className="mt-1 w-full rounded-md bg-surface border border-border px-3 py-2 min-h-28"
                    value={editForm.genreIds}
                    onChange={handleEditGenreChange}
                  >
                    {genreList.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              {updateMutation.error && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {asErrorMessage(updateMutation.error, 'Failed to save changes.')}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => updateMutation.mutate({ id: editTarget.id, form: editForm })}
                  disabled={updateMutation.isPending}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  onClick={closeEdit}
                  disabled={updateMutation.isPending}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Revoke confirmation ─────────────────────────────────────────────── */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-background shadow-2xl">
            <div className="p-5 space-y-4">
              <h2 className="text-base font-semibold text-red-300">Revoke published album</h2>
              <p className="text-sm text-foreground">
                <strong>{revokeTarget.title}</strong> by <strong>{revokeTarget.artistName}</strong> will
                be unpublished and moved back to staging. All tracks in this album will also be affected.
                A reviewer must re-approve it before it appears on the platform again.
              </p>
              <label className="text-sm">
                Reason <span className="text-muted-fg">(optional — notifies the creator)</span>
                <textarea
                  className="mt-1 w-full rounded-md bg-surface border border-border px-3 py-2 min-h-20 resize-y"
                  value={revokeNotes}
                  onChange={(e) => setRevokeNotes(e.target.value)}
                  placeholder="e.g. Cover art needs to be updated before re-publishing"
                />
              </label>

              {revokeMutation.error && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {asErrorMessage(revokeMutation.error, 'Failed to revoke album.')}
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
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface disabled:opacity-60"
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
