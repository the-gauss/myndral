/**
 * StagingPanel — review queue for artists, albums, and tracks.
 *
 * All three entity types appear in separate sections within one panel.
 * Reviewers (content_reviewer, admin) can approve, reject, or send any entity
 * back for revision. Reject and "send for revision" both require a notes field
 * so the creator receives actionable feedback in their notification.
 *
 * A highlight target can be passed from the notifications bell to scroll the
 * relevant row into view.
 */
import type { AxiosError } from 'axios'
import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveStagingArtist, rejectStagingArtist, sendArtistForReview,
  approveStagingAlbum,  rejectStagingAlbum,  sendAlbumForReview,
  approveTrack,         rejectTrack,         sendTrackForReview,
  fetchGeneratedMusicFile,
  listStaging,
} from '../services/internal'
import { useAuthStore } from '../store/authStore'
import type { EntityType, StagingArtist, StagingAlbum, StagingTrack, StagingReviewAction } from '../types'
import type { StagingNavTarget } from './NotificationsBell'

// ── Utility helpers ────────────────────────────────────────────────────────────

function asErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ detail?: string }>
  return axiosError?.response?.data?.detail ?? fallback
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '-'
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

function reviewLabel(action: StagingReviewAction): string {
  if (action === 'sent_for_review') return 'Returned for revision'
  if (action === 'approved') return 'Approved'
  if (action === 'rejected') return 'Rejected'
  return action
}

function reviewBadgeClass(action: StagingReviewAction): string {
  if (action === 'approved') return 'bg-green-500/15 text-green-300 border-green-500/30'
  if (action === 'rejected') return 'bg-red-500/15 text-red-300 border-red-500/30'
  return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
}

const REVIEWER_ROLES = new Set(['content_reviewer', 'admin'])

// ── Shared sub-types ──────────────────────────────────────────────────────────

interface NotesModalState {
  entityType: EntityType
  entityId: string
  entityName: string
  /** 'reject' archives the entity; 'revision' sends it back to the creator for changes */
  intent: 'reject' | 'revision'
}

interface PreviewState {
  url: string
  trackId: string
  title: string
}

// ── Review badge ───────────────────────────────────────────────────────────────

function LatestReviewCell({ review }: { review: { action: StagingReviewAction; notes: string | null; reviewerName: string | null; createdAt: string | null } | null }) {
  if (!review) return <span className="text-xs text-muted-fg">Awaiting review</span>
  return (
    <div>
      <span className={`inline-block rounded border px-1.5 py-0.5 text-xs ${reviewBadgeClass(review.action)}`}>
        {reviewLabel(review.action)}
      </span>
      {review.notes && (
        <p className="mt-1 max-w-xs text-xs text-muted-fg line-clamp-2">{review.notes}</p>
      )}
      <p className="mt-0.5 text-xs text-muted-fg/60">
        by {review.reviewerName ?? '—'} · {formatDate(review.createdAt)}
      </p>
    </div>
  )
}

// ── Action buttons (shared across entity types) ───────────────────────────────

function ActionButtons({
  entityType, entityId,
  canAct, isPending, hasAudio,
  onApprove, onOpenNotes, onPreview,
}: {
  entityType: EntityType
  entityId: string
  canAct: boolean
  isPending: boolean
  hasAudio: boolean
  onApprove: () => void
  onOpenNotes: (intent: 'reject' | 'revision') => void
  onPreview?: () => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {hasAudio && onPreview && (
        <button
          className="rounded border border-border px-2 py-1 text-xs hover:bg-surface disabled:opacity-60"
          disabled={isPending}
          onClick={onPreview}
        >
          Preview
        </button>
      )}
      {canAct && (
        <>
          <button
            className="rounded border border-green-500/40 bg-green-500/10 px-2 py-1 text-xs text-green-300 hover:bg-green-500/20 disabled:opacity-60"
            disabled={isPending}
            onClick={onApprove}
          >
            Approve
          </button>
          <button
            className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-60"
            disabled={isPending}
            onClick={() => onOpenNotes('reject')}
          >
            Reject
          </button>
          <button
            className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/20 disabled:opacity-60"
            disabled={isPending}
            onClick={() => onOpenNotes('revision')}
          >
            Revision
          </button>
        </>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function StagingPanel({
  highlightTarget,
}: {
  highlightTarget?: StagingNavTarget | null
}) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isReviewer = REVIEWER_ROLES.has(user?.role ?? '')

  const [notesModal, setNotesModal]   = useState<NotesModalState | null>(null)
  const [notesText, setNotesText]     = useState('')
  const [preview, setPreview]         = useState<PreviewState | null>(null)
  const highlightRef = useRef<HTMLTableRowElement | null>(null)

  const staging = useQuery({
    queryKey: ['staging'],
    queryFn: listStaging,
    refetchInterval: 30_000,
  })

  // Scroll highlighted entity into view when staging data arrives
  useEffect(() => {
    if (highlightTarget && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightTarget, staging.data])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])

  // ── Artist mutations ────────────────────────────────────────────────────────
  const approveArtistMutation = useMutation({
    mutationFn: approveStagingArtist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging'] })
      // Bust every artist-related cache including the selectors in Album and Song creation panels
      queryClient.invalidateQueries({ queryKey: ['artists'] })
      queryClient.invalidateQueries({ queryKey: ['artists-options'] })
      queryClient.invalidateQueries({ queryKey: ['internal-artists-all'] })
    },
  })
  const rejectArtistMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => rejectStagingArtist(id, notes),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staging'] }); closeModal() },
  })
  const revisionArtistMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => sendArtistForReview(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      closeModal()
    },
  })

  // ── Album mutations ─────────────────────────────────────────────────────────
  const approveAlbumMutation = useMutation({
    mutationFn: approveStagingAlbum,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging'] })
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      queryClient.invalidateQueries({ queryKey: ['albums-options'] })
      queryClient.invalidateQueries({ queryKey: ['internal-albums-for-artist'] })
    },
  })
  const rejectAlbumMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => rejectStagingAlbum(id, notes),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staging'] }); closeModal() },
  })
  const revisionAlbumMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => sendAlbumForReview(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      closeModal()
    },
  })

  // ── Track mutations ─────────────────────────────────────────────────────────
  const approveTrackMutation = useMutation({
    mutationFn: approveTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging'] })
      queryClient.invalidateQueries({ queryKey: ['tracks'] })
      // Track approval cascades to album + artist — bust all related caches
      queryClient.invalidateQueries({ queryKey: ['artists'] })
      queryClient.invalidateQueries({ queryKey: ['artists-options'] })
      queryClient.invalidateQueries({ queryKey: ['internal-artists-all'] })
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      queryClient.invalidateQueries({ queryKey: ['albums-options'] })
      queryClient.invalidateQueries({ queryKey: ['internal-albums-for-artist'] })
    },
  })
  const rejectTrackMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => rejectTrack(id, notes),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staging'] }); closeModal() },
  })
  const revisionTrackMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => sendTrackForReview(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      closeModal()
    },
  })

  const previewMutation = useMutation({
    mutationFn: async (track: StagingTrack) => {
      const blob = await fetchGeneratedMusicFile(track.outputStorageUrl!)
      return { url: URL.createObjectURL(blob), trackId: track.id, title: track.title }
    },
    onSuccess: (result) => {
      setPreview((prev) => { if (prev) URL.revokeObjectURL(prev.url); return result })
    },
  })

  // ── Modal helpers ───────────────────────────────────────────────────────────

  function openModal(state: NotesModalState) {
    setNotesModal(state)
    setNotesText('')
    // Reset relevant mutation errors
    rejectArtistMutation.reset()
    rejectAlbumMutation.reset()
    rejectTrackMutation.reset()
    revisionArtistMutation.reset()
    revisionAlbumMutation.reset()
    revisionTrackMutation.reset()
  }

  function closeModal() {
    setNotesModal(null)
    setNotesText('')
  }

  function submitNotes() {
    if (!notesModal || !notesText.trim()) return
    const { entityType, entityId, intent } = notesModal
    const args = { id: entityId, notes: notesText.trim() }

    if (entityType === 'artist') {
      intent === 'reject' ? rejectArtistMutation.mutate(args) : revisionArtistMutation.mutate(args)
    } else if (entityType === 'album') {
      intent === 'reject' ? rejectAlbumMutation.mutate(args) : revisionAlbumMutation.mutate(args)
    } else {
      intent === 'reject' ? rejectTrackMutation.mutate(args) : revisionTrackMutation.mutate(args)
    }
  }

  const modalMutationPending =
    rejectArtistMutation.isPending || rejectAlbumMutation.isPending || rejectTrackMutation.isPending ||
    revisionArtistMutation.isPending || revisionAlbumMutation.isPending || revisionTrackMutation.isPending

  const modalMutationError =
    rejectArtistMutation.error || rejectAlbumMutation.error || rejectTrackMutation.error ||
    revisionArtistMutation.error || revisionAlbumMutation.error || revisionTrackMutation.error

  // ── Derived data ────────────────────────────────────────────────────────────

  const artists: StagingArtist[] = staging.data?.artists ?? []
  const albums:  StagingAlbum[]  = staging.data?.albums  ?? []
  const tracks:  StagingTrack[]  = staging.data?.tracks  ?? []
  const totalAll = (staging.data?.totalArtists ?? 0) + (staging.data?.totalAlbums ?? 0) + (staging.data?.totalTracks ?? 0)

  function isHighlighted(entityType: EntityType, entityId: string): boolean {
    return highlightTarget?.entityType === entityType && highlightTarget?.entityId === entityId
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-surface/40 p-4">
        <h3 className="text-lg font-semibold">Staging</h3>
        <p className="mt-1 text-sm text-muted-fg">
          Content pending review before going live in the player.
          {isReviewer
            ? ' As a reviewer you can approve, reject, or request revisions on any item.'
            : ' You can preview your own submissions. A reviewer will action them.'}
        </p>
      </div>

      {staging.isLoading && <p className="text-sm text-muted-fg">Loading staging queue…</p>}

      {!staging.isLoading && totalAll === 0 && (
        <div className="rounded-lg border border-border bg-surface/20 px-4 py-8 text-center text-sm text-muted-fg">
          Staging queue is empty.
        </div>
      )}

      {/* ── Artists section ──────────────────────────────────────────────── */}
      {artists.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="border-b border-border bg-surface/70 px-4 py-3 text-sm font-medium">
            Artists ({staging.data?.totalArtists ?? 0})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/40 text-left">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Creator</th>
                  <th className="px-3 py-2">Latest review</th>
                  <th className="px-3 py-2">Submitted</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {artists.map((artist) => {
                  const highlighted = isHighlighted('artist', artist.id)
                  return (
                    <tr
                      key={artist.id}
                      ref={highlighted ? highlightRef : null}
                      className={`border-t border-border/60 align-top transition-colors ${highlighted ? 'bg-accent/10 ring-1 ring-inset ring-accent/40' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium">{artist.name}</p>
                        <p className="text-xs text-muted-fg">{artist.slug}</p>
                        {artist.bio && (
                          <p className="mt-0.5 text-xs text-muted-fg line-clamp-2 max-w-xs">{artist.bio}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <p>{artist.createdByName}</p>
                        <p className="text-xs text-muted-fg capitalize">{artist.createdByRole.replace(/_/g, ' ')}</p>
                      </td>
                      <td className="px-3 py-2"><LatestReviewCell review={artist.latestReview} /></td>
                      <td className="px-3 py-2 text-xs text-muted-fg tabular-nums">{formatDate(artist.createdAt)}</td>
                      <td className="px-3 py-2">
                        <ActionButtons
                          entityType="artist"
                          entityId={artist.id}
                          canAct={isReviewer}
                          isPending={approveArtistMutation.isPending}
                          hasAudio={false}
                          onApprove={() => approveArtistMutation.mutate(artist.id)}
                          onOpenNotes={(intent) => openModal({ entityType: 'artist', entityId: artist.id, entityName: artist.name, intent })}
                        />
                        {approveArtistMutation.error && approveArtistMutation.variables === artist.id && (
                          <p className="mt-1 text-xs text-red-300">{asErrorMessage(approveArtistMutation.error, 'Approval failed.')}</p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Albums section ───────────────────────────────────────────────── */}
      {albums.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="border-b border-border bg-surface/70 px-4 py-3 text-sm font-medium">
            Albums ({staging.data?.totalAlbums ?? 0})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/40 text-left">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Artist</th>
                  <th className="px-3 py-2">Type / Tracks</th>
                  <th className="px-3 py-2">Creator</th>
                  <th className="px-3 py-2">Latest review</th>
                  <th className="px-3 py-2">Submitted</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {albums.map((album) => {
                  const highlighted = isHighlighted('album', album.id)
                  return (
                    <tr
                      key={album.id}
                      ref={highlighted ? highlightRef : null}
                      className={`border-t border-border/60 align-top transition-colors ${highlighted ? 'bg-accent/10 ring-1 ring-inset ring-accent/40' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium">{album.title}</p>
                        <p className="text-xs text-muted-fg">{album.slug}</p>
                      </td>
                      <td className="px-3 py-2">{album.artistName}</td>
                      <td className="px-3 py-2">
                        <p className="capitalize">{album.albumType}</p>
                        <p className="text-xs text-muted-fg">{album.trackCount} track{album.trackCount !== 1 ? 's' : ''}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p>{album.createdByName}</p>
                        <p className="text-xs text-muted-fg capitalize">{album.createdByRole.replace(/_/g, ' ')}</p>
                      </td>
                      <td className="px-3 py-2"><LatestReviewCell review={album.latestReview} /></td>
                      <td className="px-3 py-2 text-xs text-muted-fg tabular-nums">{formatDate(album.createdAt)}</td>
                      <td className="px-3 py-2">
                        <ActionButtons
                          entityType="album"
                          entityId={album.id}
                          canAct={isReviewer}
                          isPending={approveAlbumMutation.isPending}
                          hasAudio={false}
                          onApprove={() => approveAlbumMutation.mutate(album.id)}
                          onOpenNotes={(intent) => openModal({ entityType: 'album', entityId: album.id, entityName: album.title, intent })}
                        />
                        {approveAlbumMutation.error && approveAlbumMutation.variables === album.id && (
                          <p className="mt-1 text-xs text-red-300">{asErrorMessage(approveAlbumMutation.error, 'Approval failed.')}</p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tracks section ───────────────────────────────────────────────── */}
      {tracks.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="border-b border-border bg-surface/70 px-4 py-3 text-sm font-medium">
            Tracks ({staging.data?.totalTracks ?? 0})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/40 text-left">
                <tr>
                  <th className="px-3 py-2">Track</th>
                  <th className="px-3 py-2">Artist / Album</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Creator</th>
                  <th className="px-3 py-2">Latest review</th>
                  <th className="px-3 py-2">Submitted</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((track) => {
                  const highlighted = isHighlighted('track', track.id)
                  return (
                    <tr
                      key={track.id}
                      ref={highlighted ? highlightRef : null}
                      className={`border-t border-border/60 align-top transition-colors ${highlighted ? 'bg-accent/10 ring-1 ring-inset ring-accent/40' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium">{track.title}</p>
                        {track.explicit && (
                          <span className="mt-0.5 inline-block rounded bg-red-500/20 px-1 text-xs text-red-300">E</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{track.primaryArtistName}</p>
                        <p className="text-xs text-muted-fg">{track.albumTitle} · <span className="capitalize">{track.albumType}</span></p>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatDuration(track.durationMs)}</td>
                      <td className="px-3 py-2">
                        <p>{track.createdByName}</p>
                        <p className="text-xs text-muted-fg capitalize">{track.createdByRole.replace(/_/g, ' ')}</p>
                      </td>
                      <td className="px-3 py-2"><LatestReviewCell review={track.latestReview} /></td>
                      <td className="px-3 py-2 text-xs text-muted-fg tabular-nums">{formatDate(track.createdAt)}</td>
                      <td className="px-3 py-2">
                        <ActionButtons
                          entityType="track"
                          entityId={track.id}
                          canAct={isReviewer}
                          isPending={approveTrackMutation.isPending}
                          hasAudio={!!track.outputStorageUrl}
                          onApprove={() => approveTrackMutation.mutate(track.id)}
                          onOpenNotes={(intent) => openModal({ entityType: 'track', entityId: track.id, entityName: track.title, intent })}
                          onPreview={() => previewMutation.mutate(track)}
                        />
                        {approveTrackMutation.error && approveTrackMutation.variables === track.id && (
                          <p className="mt-1 text-xs text-red-300">{asErrorMessage(approveTrackMutation.error, 'Approval failed.')}</p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Inline audio preview player for tracks */}
          {preview && (
            <div className="border-t border-border bg-surface/30 px-4 py-3">
              <p className="text-xs text-muted-fg">
                Previewing: <span className="font-medium text-foreground">{preview.title}</span>
              </p>
              <audio controls src={preview.url} className="mt-2 w-full" />
            </div>
          )}
        </div>
      )}

      {/* ── Notes modal (reject / revision) ─────────────────────────────── */}
      {notesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl">
            <h4 className="text-base font-semibold capitalize">
              {notesModal.intent === 'reject' ? 'Reject' : 'Request revision'}
            </h4>
            <p className="mt-1 text-sm text-muted-fg">
              {notesModal.intent === 'reject'
                ? <>Rejecting <strong>{notesModal.entityName}</strong> will move it to the archive. Add a note for the creator.</>
                : <>Returning <strong>{notesModal.entityName}</strong> for revision. The creator will be notified.</>}
            </p>

            <textarea
              className="mt-3 min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder={
                notesModal.intent === 'reject'
                  ? 'The quality does not meet our standards because…'
                  : 'Please revisit the intro — it feels too abrupt…'
              }
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              autoFocus
            />

            {modalMutationError && (
              <p className="mt-2 text-sm text-red-300">
                {asErrorMessage(modalMutationError, 'Action failed. Please try again.')}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-60"
                onClick={closeModal}
                disabled={modalMutationPending}
              >
                Cancel
              </button>
              <button
                className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60
                  ${notesModal.intent === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-accent hover:bg-accent/90'}`}
                disabled={!notesText.trim() || modalMutationPending}
                onClick={submitNotes}
              >
                {modalMutationPending
                  ? 'Saving…'
                  : notesModal.intent === 'reject' ? 'Reject' : 'Send for revision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
