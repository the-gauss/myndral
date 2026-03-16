import type { AxiosError } from 'axios'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listManagedUsers, listSubscriptionPlans, updateManagedUser } from '../services/internal'
import { useAuthStore } from '../store/authStore'
import type { AdminManagedUser, SubscriptionPlan, UserRole } from '../types'

const ROLE_OPTIONS: UserRole[] = ['listener', 'content_editor', 'content_reviewer', 'admin']
const PLAN_OPTIONS: SubscriptionPlan[] = ['free', 'premium_monthly', 'premium_annual']

interface UserDraft {
  role: UserRole
  subscriptionPlan: SubscriptionPlan
  isActive: boolean
}

function asErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ detail?: unknown }>
  const detail = axiosError?.response?.data?.detail
  return typeof detail === 'string' && detail.trim() ? detail.trim() : fallback
}

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function UserManagementPanel() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({})
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const plans = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: listSubscriptionPlans,
  })

  const users = useQuery({
    queryKey: ['managed-users', search, roleFilter],
    queryFn: () =>
      listManagedUsers({
        q: search.trim() || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
        limit: 100,
      }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ userId, draft }: { userId: string; draft: UserDraft }) =>
      updateManagedUser(userId, draft),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] })
      setDrafts((current) => {
        const next = { ...current }
        delete next[user.id]
        return next
      })
      setSaveMessage(`Updated ${user.displayName || user.username}.`)
    },
  })

  const availablePlans = useMemo(() => {
    if (plans.data?.length) return plans.data.map((plan) => plan.slug)
    return PLAN_OPTIONS
  }, [plans.data])

  function getDraft(user: AdminManagedUser): UserDraft {
    return drafts[user.id] ?? {
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
      isActive: user.isActive,
    }
  }

  function setDraft(user: AdminManagedUser, patch: Partial<UserDraft>) {
    setDrafts((current) => ({
      ...current,
      [user.id]: {
        ...getDraft(user),
        ...patch,
      },
    }))
    setSaveMessage(null)
  }

  function isDirty(user: AdminManagedUser) {
    const draft = getDraft(user)
    return (
      draft.role !== user.role ||
      draft.subscriptionPlan !== user.subscriptionPlan ||
      draft.isActive !== user.isActive
    )
  }

  return (
    <section className="space-y-6">
      <div className="studio-card rounded-[28px] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-fg">
              Shared Accounts
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">User Management</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-fg">
              Listener and Studio access live on the same user records. Admins can inspect
              subscription state, platform privileges, and role assignments from one panel.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search username, email, or display name"
              className="glass-input min-w-[260px] rounded-2xl px-4 py-2.5 text-sm"
            />
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as 'all' | UserRole)}
              className="glass-input rounded-2xl px-4 py-2.5 text-sm"
            >
              <option value="all">All roles</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>{humanize(role)}</option>
              ))}
            </select>
          </div>
        </div>

        {saveMessage && (
          <div className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
            {saveMessage}
          </div>
        )}
        {updateMutation.isError && (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {asErrorMessage(updateMutation.error, 'Could not update the user.')}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {users.isLoading ? (
          <div className="studio-card rounded-[28px] p-6 text-sm text-muted-fg">
            Loading platform users...
          </div>
        ) : users.data && users.data.items.length > 0 ? (
          users.data.items.map((user) => {
            const draft = getDraft(user)
            const dirty = isDirty(user)
            const isSelf = currentUser?.id === user.id

            return (
              <article key={user.id} className="studio-card-soft rounded-[28px] p-5">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold">{user.displayName}</h3>
                      <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-fg">
                        @{user.username}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${
                          user.isActive
                            ? 'border-green-500/30 bg-green-500/10 text-green-300'
                            : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {isSelf && (
                        <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">
                          You
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-muted-fg">
                      <p>{user.email}</p>
                      <p>Created {new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {user.privileges.map((privilege) => (
                        <span
                          key={privilege}
                          className="rounded-full border border-border/60 bg-background/30 px-3 py-1 text-xs text-muted-fg"
                        >
                          {humanize(privilege)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
                    <label className="space-y-1 text-xs uppercase tracking-wide text-muted-fg">
                      <span>Role</span>
                      <select
                        value={draft.role}
                        onChange={(event) => setDraft(user, { role: event.target.value as UserRole })}
                        className="glass-input w-full rounded-2xl px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                        disabled={updateMutation.isPending}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>{humanize(role)}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-xs uppercase tracking-wide text-muted-fg">
                      <span>Plan</span>
                      <select
                        value={draft.subscriptionPlan}
                        onChange={(event) =>
                          setDraft(user, { subscriptionPlan: event.target.value as SubscriptionPlan })
                        }
                        className="glass-input w-full rounded-2xl px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                        disabled={updateMutation.isPending}
                      >
                        {availablePlans.map((plan) => (
                          <option key={plan} value={plan}>{humanize(plan)}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-xs uppercase tracking-wide text-muted-fg">
                      <span>Status</span>
                      <select
                        value={draft.isActive ? 'active' : 'inactive'}
                        onChange={(event) => setDraft(user, { isActive: event.target.value === 'active' })}
                        className="glass-input w-full rounded-2xl px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                        disabled={updateMutation.isPending || isSelf}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>

                    <div className="sm:col-span-3 flex items-center justify-end gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setDrafts((current) => {
                          const next = { ...current }
                          delete next[user.id]
                          return next
                        })}
                        disabled={!dirty || updateMutation.isPending}
                        className="glass-pill rounded-full px-4 py-2 text-sm text-muted-fg disabled:opacity-40"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => updateMutation.mutate({ userId: user.id, draft })}
                        disabled={!dirty || updateMutation.isPending}
                        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-40"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            )
          })
        ) : (
          <div className="studio-card rounded-[28px] p-6 text-sm text-muted-fg">
            No users matched the current filters.
          </div>
        )}
      </div>
    </section>
  )
}
