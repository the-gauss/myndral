/**
 * CreateArtistPanel — create new artists and browse the existing artist catalog.
 *
 * Flow: fill form → Preview & Submit → confirmation card → submit to staging.
 * All created artists go directly to status='review'; status transitions happen
 * exclusively through staging endpoints.
 *
 * Catalog actions (non-archived artists):
 *  - Edit: available to all roles. Artist name is immutable after creation.
 *  - Revoke: admin-only, published artists only. Pulls the artist back to staging.
 */
import type { AxiosError } from 'axios'
import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createArtist,
  listArtists,
  listGenres,
  revokeArtist as revokeArtistApi,
  updateArtist,
} from '../services/internal'
import type { ArtistItem, ContentStatus } from '../types'
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

// Name is excluded — it is immutable after creation.
interface EditArtistForm {
  slug: string
  bio: string
  imageUrl: string
  headerImageUrl: string
  personaPrompt: string
  styleTags: string
  genreIds: string[]
}

export default function CreateArtistPanel() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'

  // Form state
  const [draft, setDraft] = useState<ArtistDraft>(EMPTY_DRAFT)
  const [formError, setFormError] = useState<string | null>(null)
  // Preview step: null = form, non-null = preview before submit
  const [preview, setPreview] = useState<ArtistDraft | null>(null)
  const [successName, setSuccessName] = useState<string | null>(null)

  // Catalog browse
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all')

  // Edit modal
  const [editTarget, setEditTarget] = useState<ArtistItem | null>(null)
  const [editForm, setEditForm] = useState<EditArtistForm | null>(null)

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<ArtistItem | null>(null)
  const [revokeNotes, setRevokeNotes] = useState('')

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

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: EditArtistForm }) =>
      updateArtist(id, {
        slug: form.slug.trim() || undefined,
        bio: form.bio.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        headerImageUrl: form.headerImageUrl.trim() || undefined,
        personaPrompt: form.personaPrompt.trim() || undefined,
        styleTags: parseCsv(form.styleTags),
        genreIds: form.genreIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artists'] })
      queryClient.invalidateQueries({ queryKey: ['artists-options'] })
      setEditTarget(null)
      setEditForm(null)
    },
  })

  const revokeMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      revokeArtistApi(id, notes.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artists'] })
      queryClient.invalidateQueries({ queryKey: ['staging'] })
      setRevokeTarget(null)
      setRevokeNotes('')
    },
  })

  function openEditArtist(artist: ArtistItem) {
    setEditTarget(artist)
    setEditForm({
      slug: artist.slug,
      bio: artist.bio ?? '',
      imageUrl: artist.imageUrl ?? '',
      headerImageUrl: artist.headerImageUrl ?? '',
      personaPrompt: artist.personaPrompt ?? '',
      styleTags: artist.styleTags.join(', '),
      genreIds: artist.genreIds,
    })
    updateMutation.reset()
  }

  function closeEdit() {
    setEditTarget(null)
    setEditForm(null)
    updateMutation.reset()
  }

  function set(key: keyof ArtistDraft) {
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
              className="studio-outline-button rounded-md px-4 py-2 text-sm disabled:opacity-60"
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {/* ── Create form ─────────────────────────────────────────────────────── */}
      {!preview && (
        <form onSubmit={handlePreview} className="studio-card rounded-[26px] p-5 space-y-4">
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
        <div className="studio-card rounded-[24px] grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
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
          <div className="studio-table-card rounded-[24px] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="studio-table-head text-left">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Portrait</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(artists.data?.items ?? []).map((artist: ArtistItem) => (
                  <tr key={artist.id} className="studio-table-row border-t">
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
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {/* Edit is available for any non-archived artist */}
                        {artist.status !== 'archived' && (
                          <button
                            onClick={() => openEditArtist(artist)}
                            className="studio-outline-button rounded px-2 py-1 text-xs"
                          >
                            Edit
                          </button>
                        )}
                        {/* Revoke is admin-only and only applicable to published artists */}
                        {isAdmin && artist.status === 'published' && (
                          <button
                            onClick={() => { setRevokeTarget(artist); setRevokeNotes(''); revokeMutation.reset() }}
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

        {!artists.isLoading && (artists.data?.items ?? []).length === 0 && (
          <p className="text-sm text-muted-fg">No artists found.</p>
        )}
      </div>

      {/* ── Edit artist modal ───────────────────────────────────────────────── */}
      {editTarget && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="studio-modal-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px]">
            <div className="studio-divider flex items-start justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">Edit artist</h2>
                <p className="mt-0.5 text-xs text-muted-fg">Artist name cannot be changed after creation.</p>
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
              {/* Name — read-only, clearly labelled as immutable */}
              <div className="studio-readonly rounded-2xl px-3 py-2 text-sm">
                <p className="text-xs text-muted-fg mb-0.5">Name (immutable)</p>
                <p className="font-medium">{editTarget.name}</p>
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
                <div />
                <div>
                  <ImageInput
                    label="Portrait image"
                    value={editForm.imageUrl}
                    onChange={(url) => setEditForm((f) => f && ({ ...f, imageUrl: url }))}
                    placeholder="data/images/artist.jpg  or  https://..."
                  />
                </div>
                <div>
                  <ImageInput
                    label="Header image"
                    value={editForm.headerImageUrl}
                    onChange={(url) => setEditForm((f) => f && ({ ...f, headerImageUrl: url }))}
                    placeholder="data/images/artist-header.jpg"
                  />
                </div>
                <label className="text-sm lg:col-span-2">
                  Bio
                  <textarea
                    className="mt-1 w-full rounded-md bg-surface border border-border px-3 py-2 min-h-24 resize-y"
                    value={editForm.bio}
                    onChange={(e) => setEditForm((f) => f && ({ ...f, bio: e.target.value }))}
                  />
                </label>
                <label className="text-sm lg:col-span-2">
                  Persona prompt
                  <textarea
                    className="mt-1 w-full rounded-md bg-surface border border-border px-3 py-2 min-h-20 resize-y"
                    value={editForm.personaPrompt}
                    onChange={(e) => setEditForm((f) => f && ({ ...f, personaPrompt: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  Style tags <span className="text-muted-fg">(comma-separated)</span>
                  <input
                    className="mt-1 w-full rounded-md bg-surface border border-border px-3 py-2"
                    value={editForm.styleTags}
                    onChange={(e) => setEditForm((f) => f && ({ ...f, styleTags: e.target.value }))}
                    placeholder="ambient, electronic, cinematic"
                  />
                </label>
                <label className="text-sm">
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
                  className="studio-outline-button rounded-md px-4 py-2 text-sm disabled:opacity-60"
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
          <div className="studio-modal-card w-full max-w-md rounded-[28px] ring-1 ring-inset ring-danger/20">
            <div className="p-5 space-y-4">
              <h2 className="text-base font-semibold text-red-300">Revoke published artist</h2>
              <p className="text-sm text-foreground">
                <strong>{revokeTarget.name}</strong> will be unpublished and moved back to staging.
                A reviewer must re-approve it before it appears on the platform again.
              </p>
              <label className="text-sm">
                Reason <span className="text-muted-fg">(optional — notifies the creator)</span>
                <textarea
                  className="mt-1 w-full rounded-md bg-surface border border-border px-3 py-2 min-h-20 resize-y"
                  value={revokeNotes}
                  onChange={(e) => setRevokeNotes(e.target.value)}
                  placeholder="e.g. Metadata update required before re-publishing"
                />
              </label>

              {revokeMutation.error && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {asErrorMessage(revokeMutation.error, 'Failed to revoke artist.')}
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
