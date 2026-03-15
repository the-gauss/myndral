/**
 * Dashboard — top-level shell for the internal Studio tool.
 *
 * All content sections are delegated to self-contained panel components.
 * This file is intentionally thin: it owns only navigation state, the
 * header, and the notification→staging routing bridge.
 *
 * Tabs:
 *   artists     → CreateArtistPanel  (create + catalog browse)
 *   albums      → CreateAlbumPanel   (create + catalog browse)
 *   create_music→ CreateMusicPanel   (generate/upload + catalog browse, replaces old "Tracks" tab)
 *   staging     → StagingPanel       (review queue for artists, albums, and tracks)
 *   archive     → ArchivePanel       (rejected items with restore capability)
 */
import { useState } from 'react'
import ArchivePanel from '../components/ArchivePanel'
import CreateAlbumPanel from '../components/CreateAlbumPanel'
import CreateArtistPanel from '../components/CreateArtistPanel'
import CreateMusicPanel from '../components/CreateMusicPanel'
import NotificationsBell from '../components/NotificationsBell'
import StagingPanel from '../components/StagingPanel'
import { useAuthStore } from '../store/authStore'
import type { StagingNavTarget } from '../components/NotificationsBell'

type Tab = 'artists' | 'albums' | 'create_music' | 'staging' | 'archive'

const TAB_LABELS: Record<Tab, string> = {
  artists: 'Artists',
  albums: 'Albums',
  create_music: 'Songs',
  staging: 'Staging',
  archive: 'Archive',
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const clearSession = useAuthStore((s) => s.clearSession)

  const [tab, setTab] = useState<Tab>('artists')
  // Populated when the user clicks a notification — scrolls the target entity
  // into view in the staging panel.
  const [stagingHighlightTarget, setStagingHighlightTarget] = useState<StagingNavTarget | null>(null)

  function navigateToStaging(target: StagingNavTarget) {
    setStagingHighlightTarget(target)
    setTab('staging')
  }

  function handleTabChange(next: Tab) {
    setTab(next)
    // Clear the staging highlight when navigating away so it doesn't
    // persist if the user returns to staging via a normal tab click.
    if (next !== 'staging') setStagingHighlightTarget(null)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold tracking-tight">MyndralAI Studio</span>

          <nav className="flex gap-1">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <button
                key={t}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors
                  ${tab === t
                    ? 'bg-accent text-accent-fg font-medium'
                    : 'text-muted-fg hover:text-foreground hover:bg-surface'}`}
                onClick={() => handleTabChange(t)}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <NotificationsBell onNavigateToStaging={navigateToStaging} />
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-fg sm:block">
                {user?.displayName ?? user?.username}
                <span className="ml-1 capitalize text-muted-fg/60">
                  · {user?.role?.replace(/_/g, ' ')}
                </span>
              </span>
              <button
                className="rounded-md border border-border px-3 py-1 text-xs hover:bg-surface"
                onClick={clearSession}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {tab === 'artists'      && <CreateArtistPanel />}
        {tab === 'albums'       && <CreateAlbumPanel />}
        {tab === 'create_music' && <CreateMusicPanel />}
        {tab === 'staging'      && <StagingPanel highlightTarget={stagingHighlightTarget} />}
        {tab === 'archive'      && <ArchivePanel />}
      </main>
    </div>
  )
}
