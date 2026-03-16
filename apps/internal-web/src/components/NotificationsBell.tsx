import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/internal'
import type { EntityType, Notification } from '../types'

function formatDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

export interface StagingNavTarget {
  entityType: EntityType
  entityId: string
}

export default function NotificationsBell({
  onNavigateToStaging,
}: {
  onNavigateToStaging?: (target: StagingNavTarget) => void
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const notifs = useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications({ limit: 30 }),
    refetchInterval: 30_000,
  })

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const items: Notification[] = notifs.data?.items ?? []
  const unreadCount = notifs.data?.unreadCount ?? 0

  function handleItemClick(notif: Notification) {
    if (!notif.isRead) {
      markReadMutation.mutate(notif.id)
    }
    if (!onNavigateToStaging) return

    // Navigate to staging for the relevant entity
    const entityId = notif.trackId ?? notif.artistId ?? notif.albumId
    if (entityId) {
      onNavigateToStaging({ entityType: notif.entityType, entityId })
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        className="relative rounded-md p-1.5 hover:bg-surface"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-0.5 text-[10px] font-bold text-accent-fg">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-xs text-accent-fg">
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                className="text-xs text-muted-fg hover:text-foreground disabled:opacity-60"
                disabled={markAllMutation.isPending}
                onClick={() => markAllMutation.mutate()}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifs.isLoading && (
              <p className="px-3 py-4 text-center text-sm text-muted-fg">Loading…</p>
            )}
            {!notifs.isLoading && items.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-muted-fg">No notifications yet.</p>
            )}
            {items.map((notif) => (
              <button
                key={notif.id}
                className={`w-full border-b border-border/50 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-background/60 ${!notif.isRead ? 'bg-accent/5' : ''}`}
                onClick={() => handleItemClick(notif)}
              >
                <div className="flex items-start gap-2">
                  {!notif.isRead && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  )}
                  <div className={!notif.isRead ? '' : 'pl-4'}>
                    {notif.entityName && (
                      <p className="text-xs font-medium text-foreground">{notif.entityName}</p>
                    )}
                    <p className="text-xs text-muted-fg">{notif.message}</p>
                    <p className="mt-0.5 text-[10px] text-muted-fg/60">{formatDate(notif.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
