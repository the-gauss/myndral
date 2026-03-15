import type { AxiosError } from 'axios'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download, X } from 'lucide-react'
import { downloadTrack, grantAlbumLicense, grantTrackLicense } from '../../services/exports'

type ExportTarget =
  | { kind: 'track'; id: string; title: string }
  | { kind: 'album'; id: string; title: string }

interface Props {
  target: ExportTarget
  onClose: () => void
}

type Tab = 'personal' | 'business'

function asErrorMessage(error: unknown, fallback: string): string {
  const e = error as AxiosError<{ detail?: string }>
  return e.response?.data?.detail ?? fallback
}

export default function ExportModal({ target, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('personal')

  const trackMutation = useMutation({
    mutationFn: async () => {
      if (target.kind !== 'track') return
      const license = await grantTrackLicense(target.id, 'personal')
      await downloadTrack(target.id, `${target.title}.mp3`)
      return license
    },
  })

  const albumMutation = useMutation({
    mutationFn: async () => {
      if (target.kind !== 'album') return
      const license = await grantAlbumLicense(target.id, 'personal')
      // Download each track sequentially
      for (const t of license.tracks) {
        await downloadTrack(t.trackId, `${t.trackNumber} - ${t.trackTitle}.mp3`)
      }
      return license
    },
  })

  const mutation = target.kind === 'track' ? trackMutation : albumMutation
  const isPending = mutation.isPending
  const isSuccess = mutation.isSuccess

  function handlePersonalDownload() {
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Export</h2>
            <p className="text-xs text-muted-fg truncate max-w-xs">{target.title}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-fg hover:bg-background hover:text-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['personal', 'business'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'border-b-2 border-accent text-foreground'
                  : 'text-muted-fg hover:text-foreground'
              }`}
            >
              {t === 'personal' ? 'Personal Use' : 'Business Use'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {tab === 'personal' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-fg">
                Share with friends, spread the word, or listen offline. Free for Premium subscribers.
              </p>

              <ul className="space-y-1 text-sm text-muted-fg list-disc list-inside">
                <li>MP3 format, high quality (320 kbps)</li>
                <li>Non-commercial use only</li>
                {target.kind === 'album' && (
                  <li>Each track downloaded individually</li>
                )}
              </ul>

              {mutation.error && (
                <p className="text-sm text-red-400">
                  {asErrorMessage(mutation.error, 'Download failed. Please try again.')}
                </p>
              )}

              {isSuccess ? (
                <p className="text-sm text-green-400">
                  {target.kind === 'track' ? 'Download started!' : 'All tracks downloading…'}
                </p>
              ) : (
                <button
                  onClick={handlePersonalDownload}
                  disabled={isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-fg hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  <Download size={15} />
                  {isPending ? 'Preparing download…' : `Download ${target.kind === 'album' ? 'Album' : 'Track'}`}
                </button>
              )}
            </div>
          )}

          {tab === 'business' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-fg">
                For content creation, commercial use, and copyright-free requirements.
              </p>

              <div className="rounded-lg border border-border bg-background/60 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Per track</span>
                  <span className="font-semibold">$0.99</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Per album</span>
                  <span className="font-semibold">$4.99</span>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <p className="text-sm font-medium text-amber-300">Coming Soon</p>
                <p className="mt-0.5 text-xs text-amber-300/70">
                  Business licensing is on the way. Check back soon.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
