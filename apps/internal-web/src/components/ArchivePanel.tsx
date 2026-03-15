/**
 * ArchivePanel — browse archived artists, albums, and tracks.
 *
 * Archived items were rejected from staging. All three entity types are shown
 * in separate sections. Reviewers can restore any item to staging (back to
 * status='review') using the restore action.
 */
import type { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listArchive,
  restoreArtistFromArchive,
  restoreAlbumFromArchive,
  restoreTrackFromArchive,
} from '../services/internal'
import { useAuthStore } from '../store/authStore'
import type { StagingArtist, StagingAlbum, StagingTrack } from '../types'

// ── Utilities ──────────────────────────────────────────────────────────────────

function asErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ detail?: string }>
  return axiosError?.response?.data?.detail ?? fallback
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '-'
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

const REVIEWER_ROLES = new Set(['content_reviewer', 'admin'])

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="border-b border-border bg-surface/70 px-4 py-3 text-sm font-medium">
      {label} ({count})
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ArchivePanel() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isReviewer = REVIEWER_ROLES.has(user?.role ?? '')

  const archive = useQuery({
    queryKey: ['archive'],
    queryFn: listArchive,
    refetchInterval: 60_000,
  })

  const restoreArtistMutation = useMutation({
    mutationFn: restoreArtistFromArchive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      queryClient.invalidateQueries({ queryKey: ['staging'] })
      queryClient.invalidateQueries({ queryKey: ['artists'] })
    },
  })

  const restoreAlbumMutation = useMutation({
    mutationFn: restoreAlbumFromArchive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      queryClient.invalidateQueries({ queryKey: ['staging'] })
      queryClient.invalidateQueries({ queryKey: ['albums'] })
    },
  })

  const restoreTrackMutation = useMutation({
    mutationFn: restoreTrackFromArchive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      queryClient.invalidateQueries({ queryKey: ['staging'] })
      queryClient.invalidateQueries({ queryKey: ['tracks'] })
    },
  })

  const artists: StagingArtist[] = archive.data?.artists ?? []
  const albums:  StagingAlbum[]  = archive.data?.albums  ?? []
  const tracks:  StagingTrack[]  = archive.data?.tracks  ?? []
  const totalAll = (archive.data?.totalArtists ?? 0) + (archive.data?.totalAlbums ?? 0) + (archive.data?.totalTracks ?? 0)

  return (
    <section className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-surface/40 p-4">
        <h3 className="text-lg font-semibold">Archive</h3>
        <p className="mt-1 text-sm text-muted-fg">
          Content that was rejected from staging.
          {isReviewer
            ? ' You can restore any item back to staging for another review cycle.'
            : ' Only reviewers can restore archived items.'}
        </p>
      </div>

      {archive.isLoading && <p className="text-sm text-muted-fg">Loading archive…</p>}

      {!archive.isLoading && totalAll === 0 && (
        <div className="rounded-lg border border-border bg-surface/20 px-4 py-8 text-center text-sm text-muted-fg">
          Archive is empty.
        </div>
      )}

      {/* ── Artists ──────────────────────────────────────────────────────── */}
      {artists.length > 0 && (
        <div className="rounded-lg border border-border">
          <SectionHeader label="Artists" count={archive.data?.totalArtists ?? 0} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/40 text-left">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Creator</th>
                  <th className="px-3 py-2">Rejection note</th>
                  <th className="px-3 py-2">Archived</th>
                  {isReviewer && <th className="px-3 py-2">Restore</th>}
                </tr>
              </thead>
              <tbody>
                {artists.map((artist) => (
                  <tr key={artist.id} className="border-t border-border/60 align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium">{artist.name}</p>
                      <p className="text-xs text-muted-fg">{artist.slug}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p>{artist.createdByName}</p>
                      <p className="text-xs text-muted-fg capitalize">{artist.createdByRole.replace(/_/g, ' ')}</p>
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      {artist.latestReview?.notes
                        ? <p className="text-xs text-muted-fg line-clamp-3">{artist.latestReview.notes}</p>
                        : <span className="text-xs text-muted-fg">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-fg tabular-nums">{formatDate(artist.createdAt)}</td>
                    {isReviewer && (
                      <td className="px-3 py-2">
                        <button
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-surface disabled:opacity-60"
                          disabled={restoreArtistMutation.isPending}
                          onClick={() => restoreArtistMutation.mutate(artist.id)}
                        >
                          Restore to staging
                        </button>
                        {restoreArtistMutation.error && restoreArtistMutation.variables === artist.id && (
                          <p className="mt-1 text-xs text-red-300">{asErrorMessage(restoreArtistMutation.error, 'Restore failed.')}</p>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Albums ───────────────────────────────────────────────────────── */}
      {albums.length > 0 && (
        <div className="rounded-lg border border-border">
          <SectionHeader label="Albums" count={archive.data?.totalAlbums ?? 0} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/40 text-left">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Artist</th>
                  <th className="px-3 py-2">Creator</th>
                  <th className="px-3 py-2">Rejection note</th>
                  <th className="px-3 py-2">Archived</th>
                  {isReviewer && <th className="px-3 py-2">Restore</th>}
                </tr>
              </thead>
              <tbody>
                {albums.map((album) => (
                  <tr key={album.id} className="border-t border-border/60 align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium">{album.title}</p>
                      <p className="text-xs text-muted-fg capitalize">{album.albumType}</p>
                    </td>
                    <td className="px-3 py-2">{album.artistName}</td>
                    <td className="px-3 py-2">
                      <p>{album.createdByName}</p>
                      <p className="text-xs text-muted-fg capitalize">{album.createdByRole.replace(/_/g, ' ')}</p>
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      {album.latestReview?.notes
                        ? <p className="text-xs text-muted-fg line-clamp-3">{album.latestReview.notes}</p>
                        : <span className="text-xs text-muted-fg">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-fg tabular-nums">{formatDate(album.createdAt)}</td>
                    {isReviewer && (
                      <td className="px-3 py-2">
                        <button
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-surface disabled:opacity-60"
                          disabled={restoreAlbumMutation.isPending}
                          onClick={() => restoreAlbumMutation.mutate(album.id)}
                        >
                          Restore to staging
                        </button>
                        {restoreAlbumMutation.error && restoreAlbumMutation.variables === album.id && (
                          <p className="mt-1 text-xs text-red-300">{asErrorMessage(restoreAlbumMutation.error, 'Restore failed.')}</p>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tracks ───────────────────────────────────────────────────────── */}
      {tracks.length > 0 && (
        <div className="rounded-lg border border-border">
          <SectionHeader label="Tracks" count={archive.data?.totalTracks ?? 0} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/40 text-left">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Artist / Album</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Creator</th>
                  <th className="px-3 py-2">Rejection note</th>
                  <th className="px-3 py-2">Archived</th>
                  {isReviewer && <th className="px-3 py-2">Restore</th>}
                </tr>
              </thead>
              <tbody>
                {tracks.map((track) => (
                  <tr key={track.id} className="border-t border-border/60 align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium">{track.title}</p>
                      {track.explicit && (
                        <span className="mt-0.5 inline-block rounded bg-red-500/20 px-1 text-xs text-red-300">E</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{track.primaryArtistName}</p>
                      <p className="text-xs text-muted-fg">{track.albumTitle}</p>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatDuration(track.durationMs)}</td>
                    <td className="px-3 py-2">
                      <p>{track.createdByName}</p>
                      <p className="text-xs text-muted-fg capitalize">{track.createdByRole.replace(/_/g, ' ')}</p>
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      {track.latestReview?.notes
                        ? <p className="text-xs text-muted-fg line-clamp-3">{track.latestReview.notes}</p>
                        : <span className="text-xs text-muted-fg">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-fg tabular-nums">{formatDate(track.createdAt)}</td>
                    {isReviewer && (
                      <td className="px-3 py-2">
                        <button
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-surface disabled:opacity-60"
                          disabled={restoreTrackMutation.isPending}
                          onClick={() => restoreTrackMutation.mutate(track.id)}
                        >
                          Restore to staging
                        </button>
                        {restoreTrackMutation.error && restoreTrackMutation.variables === track.id && (
                          <p className="mt-1 text-xs text-red-300">{asErrorMessage(restoreTrackMutation.error, 'Restore failed.')}</p>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
