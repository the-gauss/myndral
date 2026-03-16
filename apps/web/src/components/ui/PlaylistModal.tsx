import type { AxiosError } from 'axios'
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEditableUserPlaylists } from '../../hooks/useCatalog'
import { addTracksToPlaylist, createPlaylist } from '../../services/catalog'

interface PlaylistModalProps {
  open: boolean
  onClose: () => void
  trackIds?: string[]
  heading?: string
}

function asErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ detail?: unknown }>
  const detail = axiosError?.response?.data?.detail
  return typeof detail === 'string' && detail.trim() ? detail.trim() : fallback
}

export default function PlaylistModal({
  open,
  onClose,
  trackIds = [],
  heading = 'Playlist actions',
}: PlaylistModalProps) {
  const queryClient = useQueryClient()
  const editablePlaylists = useEditableUserPlaylists()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const hasSeedTracks = trackIds.length > 0

  const sortedPlaylists = useMemo(
    () => editablePlaylists.data?.items ?? [],
    [editablePlaylists.data?.items],
  )

  const createMutation = useMutation({
    mutationFn: () =>
      createPlaylist({
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic,
        trackIds: hasSeedTracks ? trackIds : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      queryClient.invalidateQueries({ queryKey: ['playlist'] })
      queryClient.invalidateQueries({ queryKey: ['user-playlists'] })
      queryClient.invalidateQueries({ queryKey: ['editable-user-playlists'] })
      queryClient.invalidateQueries({ queryKey: ['library-playlists'] })
      setName('')
      setDescription('')
      setIsPublic(true)
      onClose()
    },
  })

  const addMutation = useMutation({
    mutationFn: (playlistId: string) => addTracksToPlaylist(playlistId, trackIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      queryClient.invalidateQueries({ queryKey: ['playlist'] })
      queryClient.invalidateQueries({ queryKey: ['user-playlists'] })
      queryClient.invalidateQueries({ queryKey: ['editable-user-playlists'] })
      onClose()
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/70 backdrop-blur-xl">
      <div className="glass-panel-strong w-full max-w-2xl rounded-[28px] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-fg">
              Playlists
            </p>
            <h2 className="text-2xl font-semibold text-foreground">{heading}</h2>
            <p className="text-sm text-muted-fg">
              {hasSeedTracks
                ? 'Add this track to an existing playlist or spin up a new public/private playlist.'
                : 'Create a playlist for your library and listening flow.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="glass-pill rounded-full p-2 text-muted-fg hover:text-foreground"
            aria-label="Close playlist modal"
          >
            <X size={16} />
          </button>
        </div>

        {hasSeedTracks && (
          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Add to existing playlist</h3>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {sortedPlaylists.length > 0 ? (
                sortedPlaylists.map((playlist) => (
                  <button
                    key={playlist.id}
                    type="button"
                    onClick={() => addMutation.mutate(playlist.id)}
                    disabled={addMutation.isPending}
                    className="glass-panel flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left hover:bg-foreground/5"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{playlist.name}</p>
                      <p className="text-xs text-muted-fg">
                        {playlist.trackCount ?? playlist.tracks.length} songs
                        {playlist.isPublic ? ' · Public' : ' · Private'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                      Add
                    </span>
                  </button>
                ))
              ) : (
                <div className="glass-panel rounded-2xl px-4 py-4 text-sm text-muted-fg">
                  No editable playlists yet.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Create a playlist</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Late night favorites"
                className="glass-input w-full rounded-2xl px-4 py-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="A private mix for softer synthetic pop."
                className="glass-input w-full rounded-2xl px-4 py-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Visibility</span>
              <select
                value={isPublic ? 'public' : 'private'}
                onChange={(event) => setIsPublic(event.target.value === 'public')}
                className="glass-input w-full rounded-2xl px-4 py-3 text-sm text-foreground"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </label>
          </div>

          {(createMutation.isError || addMutation.isError) && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {asErrorMessage(createMutation.error ?? addMutation.error, 'Could not update the playlist.')}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="glass-pill rounded-full px-4 py-2 text-sm text-muted-fg hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || createMutation.isPending}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
            >
              Create Playlist
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
