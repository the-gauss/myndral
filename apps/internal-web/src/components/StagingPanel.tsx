import type { AxiosError } from 'axios'
import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveTrack,
  fetchGeneratedMusicFile,
  listStaging,
  rejectTrack,
  sendTrackForReview,
} from '../services/internal'
import { useAuthStore } from '../store/authStore'
import type { StagingTrack } from '../types'

function asErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ detail?: string }>
  return axiosError.response?.data?.detail ?? fallback
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '-'
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function reviewLabel(action: string): string {
  if (action === 'sent_for_review') return 'Returned for revision'
  if (action === 'approved') return 'Approved'
  if (action === 'rejected') return 'Rejected'
  return action
}

function reviewBadgeClass(action: string): string {
  if (action === 'approved') return 'bg-green-500/15 text-green-300 border-green-500/30'
  if (action === 'rejected') return 'bg-red-500/15 text-red-300 border-red-500/30'
  return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
}

const REVIEWER_ROLES = new Set(['content_reviewer', 'admin'])

interface ReviewModalState {
  trackId: string
  trackTitle: string
}

interface PreviewState {
  url: string
  trackId: string
  title: string
}

export default function StagingPanel({ highlightTrackId }: { highlightTrackId?: string | null }) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isReviewer = REVIEWER_ROLES.has(user?.role ?? '')
  const currentUserId = user?.id ?? ''

  const [reviewModal, setReviewModal] = useState<ReviewModalState | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const highlightRef = useRef<HTMLTableRowElement | null>(null)

  const staging = useQuery({
    queryKey: ['staging'],
    queryFn: () => listStaging({ limit: 100 }),
    refetchInterval: 30_000,
  })

  // Scroll highlighted track into view when it arrives
  useEffect(() => {
    if (highlightTrackId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightTrackId, staging.data])

  const approveMutation = useMutation({
    mutationFn: approveTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: rejectTrack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging'] })
    },
  })

  const reviewMutation = useMutation({
    mutationFn: ({ trackId, notes }: { trackId: string; notes: string }) =>
      sendTrackForReview(trackId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setReviewModal(null)
      setReviewNotes('')
    },
  })

  const previewMutation = useMutation({
    mutationFn: async (track: StagingTrack) => {
      const blob = await fetchGeneratedMusicFile(track.outputStorageUrl!)
      return { url: URL.createObjectURL(blob), trackId: track.id, title: track.title }
    },
    onSuccess: (result) => {
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return result
      })
    },
  })

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url)
    }
  }, [preview])

  const items: StagingTrack[] = staging.data?.items ?? []
  const total = staging.data?.total ?? 0

  function canAct(track: StagingTrack): boolean {
    if (!isReviewer) return false
    // Admin can act on own tracks, reviewer cannot (normal publisher restriction not applied here
    // since the spec says all publishers/admins can act on any track in staging)
    return true
  }

  function isOwn(track: StagingTrack): boolean {
    return track.createdById === currentUserId
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-border bg-surface/40 p-4">
        <h3 className="text-lg font-semibold">Staging</h3>
        <p className="mt-1 text-sm text-muted-fg">
          Tracks pending review before they go live in the player.
          {isReviewer
            ? ' As a publisher you can approve, reject, or send any track back for revision.'
            : ' You can preview your own tracks. A publisher will review them.'}
        </p>
      </div>

      {staging.isLoading && (
        <p className="text-sm text-muted-fg">Loading staging queue…</p>
      )}

      {!staging.isLoading && items.length === 0 && (
        <div className="rounded-lg border border-border bg-surface/20 px-4 py-8 text-center text-sm text-muted-fg">
          No tracks in staging. Generate a song to get started.
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="border-b border-border bg-surface/70 px-4 py-3 text-sm text-muted-fg">
            {total} track{total !== 1 ? 's' : ''} in staging
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/40 text-left">
                <tr>
                  <th className="px-3 py-2">Track</th>
                  <th className="px-3 py-2">Artist / Album</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Creator</th>
                  <th className="px-3 py-2">Review</th>
                  <th className="px-3 py-2">Submitted</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((track) => {
                  const own = isOwn(track)
                  const actable = canAct(track)
                  const isHighlighted = track.id === highlightTrackId
                  const rowOpacity = !own && !actable ? 'opacity-50' : ''

                  return (
                    <tr
                      key={track.id}
                      ref={isHighlighted ? highlightRef : null}
                      className={`border-t border-border/60 align-top transition-colors ${rowOpacity} ${isHighlighted ? 'bg-accent/10 ring-1 ring-inset ring-accent/40' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium">{track.title}</p>
                        {track.explicit && (
                          <span className="mt-0.5 inline-block rounded bg-red-500/20 px-1 text-xs text-red-300">E</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{track.primaryArtistName}</p>
                        <p className="text-xs text-muted-fg">{track.albumTitle} · {track.albumType}</p>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatDuration(track.durationMs)}</td>
                      <td className="px-3 py-2">
                        <p>{track.createdByName}</p>
                        <p className="text-xs text-muted-fg capitalize">{track.createdByRole.replace('_', ' ')}</p>
                      </td>
                      <td className="px-3 py-2">
                        {track.latestReview ? (
                          <div>
                            <span className={`inline-block rounded border px-1.5 py-0.5 text-xs ${reviewBadgeClass(track.latestReview.action)}`}>
                              {reviewLabel(track.latestReview.action)}
                            </span>
                            {track.latestReview.notes && (
                              <p className="mt-1 max-w-xs text-xs text-muted-fg line-clamp-2">
                                {track.latestReview.notes}
                              </p>
                            )}
                            <p className="mt-0.5 text-xs text-muted-fg/60">
                              by {track.latestReview.reviewerName} · {formatDate(track.latestReview.createdAt)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-fg">Awaiting review</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-fg tabular-nums">
                        {formatDate(track.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {/* Preview — own track always, others if actable */}
                          {(own || actable) && track.outputStorageUrl && (
                            <button
                              className="rounded border border-border px-2 py-1 text-xs hover:bg-surface disabled:opacity-60"
                              disabled={previewMutation.isPending}
                              onClick={() => previewMutation.mutate(track)}
                            >
                              Preview
                            </button>
                          )}

                          {/* Publisher-only actions */}
                          {actable && (
                            <>
                              <button
                                className="rounded border border-green-500/40 bg-green-500/10 px-2 py-1 text-xs text-green-300 hover:bg-green-500/20 disabled:opacity-60"
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                                onClick={() => approveMutation.mutate(track.id)}
                              >
                                Approve
                              </button>
                              <button
                                className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-60"
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                                onClick={() => rejectMutation.mutate(track.id)}
                              >
                                Reject
                              </button>
                              <button
                                className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/20 disabled:opacity-60"
                                onClick={() => {
                                  setReviewModal({ trackId: track.id, trackTitle: track.title })
                                  setReviewNotes('')
                                }}
                              >
                                Send for revision
                              </button>
                            </>
                          )}
                        </div>

                        {/* Inline mutation errors */}
                        {approveMutation.error && approveMutation.variables === track.id && (
                          <p className="mt-1 text-xs text-red-300">
                            {asErrorMessage(approveMutation.error, 'Approval failed.')}
                          </p>
                        )}
                        {rejectMutation.error && rejectMutation.variables === track.id && (
                          <p className="mt-1 text-xs text-red-300">
                            {asErrorMessage(rejectMutation.error, 'Rejection failed.')}
                          </p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Audio preview player */}
          {preview && (
            <div className="border-t border-border bg-surface/30 px-4 py-3">
              <p className="text-xs text-muted-fg">Previewing: <span className="font-medium text-foreground">{preview.title}</span></p>
              <audio controls src={preview.url} className="mt-2 w-full" />
            </div>
          )}
        </div>
      )}

      {/* ── Send-for-revision modal ──────────────────────────────────────── */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl">
            <h4 className="text-base font-semibold">Send for revision</h4>
            <p className="mt-1 text-sm text-muted-fg">
              Add notes for <strong>{reviewModal.trackTitle}</strong>. The creator will be
              notified.
            </p>

            <textarea
              className="mt-3 min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="The intro feels too abrupt. Consider a softer fade-in…"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              autoFocus
            />

            {reviewMutation.error && (
              <p className="mt-2 text-sm text-red-300">
                {asErrorMessage(reviewMutation.error, 'Failed to send revision request.')}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
                onClick={() => {
                  setReviewModal(null)
                  setReviewNotes('')
                }}
                disabled={reviewMutation.isPending}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-60"
                disabled={!reviewNotes.trim() || reviewMutation.isPending}
                onClick={() =>
                  reviewMutation.mutate({ trackId: reviewModal.trackId, notes: reviewNotes.trim() })
                }
              >
                {reviewMutation.isPending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
