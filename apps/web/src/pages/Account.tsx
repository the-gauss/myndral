import { CreditCard, ExternalLink, Lock, LogOut, Scroll, Settings2, Sparkles, SunMoon, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme, type Theme } from '../contexts/ThemeContext'
import { buildStudioAppUrl, userHasStudioAccess } from '../lib/crossApp'
import { useUserStore } from '../store/userStore'

const THEME_DESCRIPTIONS: Record<Theme, string> = {
  light: 'Bright and airy glass for daytime listening.',
  dark: 'Dimmed contrast with luminous depth for late hours.',
  paper: 'Premium-only Minkowski mode with textured paper warmth.',
}

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  paper: 'Minkowski',
}

const THEME_SWATCHES: Record<Theme, string[]> = {
  light: ['#b0cee2', '#e95d2c', '#45586c'],
  dark: ['#1a2730', '#45586c', '#a63e1b'],
  paper: ['#fdf5ec', '#eddfc8', '#c4956a'],
}

function humanizePlan(plan: 'free' | 'premium_monthly' | 'premium_annual' | undefined) {
  if (plan === 'premium_monthly') return 'Premium Monthly'
  if (plan === 'premium_annual') return 'Premium Annual'
  return 'Free'
}

export default function Account() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const user = useUserStore((state) => state.user)
  const accessToken = useUserStore((state) => state.accessToken)
  const isPremium = useUserStore((state) => state.isPremium)
  const clearUser = useUserStore((state) => state.clearUser)
  const hasStudioAccess = userHasStudioAccess(user?.role)
  const studioHref = hasStudioAccess
    ? buildStudioAppUrl({ accessToken })
    : buildStudioAppUrl({
        view: 'register',
        registerMode: 'existing',
        identifier: user?.username,
        clearSession: true,
      })

  function logout() {
    clearUser()
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground">Account</h1>
          <p className="mt-2 text-sm text-muted-fg">
            Profile, billing, settings, and platform access all live here.
          </p>
        </div>
        <button
          onClick={logout}
          className="glass-pill inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-semibold text-muted-fg hover:text-foreground"
        >
          <LogOut size={15} />
          Log out
        </button>
      </div>

      <section id="profile" className="glass-panel rounded-[28px] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/12 text-accent">
              <UserRound size={28} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-fg">Profile</p>
              <h2 className="mt-1 text-2xl font-semibold text-foreground">
                {user?.displayName ?? user?.username ?? 'Listener'}
              </h2>
              <p className="mt-1 text-sm text-muted-fg">
                {user?.email ?? 'No email on file'}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-background/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Plan</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{humanizePlan(user?.subscriptionPlan)}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Privilege</p>
              <p className="mt-1 text-sm font-semibold capitalize text-foreground">
                {user?.role?.replace(/_/g, ' ') ?? 'listener'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="billing" className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="glass-panel rounded-[28px] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/12 text-secondary">
              <CreditCard size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-fg">Billing & Subscription</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">{humanizePlan(user?.subscriptionPlan)}</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-background/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Streaming</p>
              <p className="mt-1 text-sm text-foreground">{isPremium ? 'High fidelity unlocked' : 'Free tier access'}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Exports</p>
              <p className="mt-1 text-sm text-foreground">{isPremium ? 'Personal exports enabled' : 'Upgrade for exports'}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Themes</p>
              <p className="mt-1 text-sm text-foreground">{isPremium ? 'Minkowski unlocked' : 'Light and Dark included'}</p>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-[28px] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12 text-accent">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-fg">Platform Access</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">
                {hasStudioAccess ? 'Studio enabled' : 'Listener account'}
              </h2>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-fg">
            The same account powers the player and Studio. Access is decided by your privilege flag.
          </p>
          <a
            href={studioHref}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg"
          >
            <ExternalLink size={15} />
            {hasStudioAccess ? 'Open Studio' : 'Request Studio Access'}
          </a>
        </div>
      </section>

      <section id="settings" className="glass-panel rounded-[28px] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Settings2 size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-fg">Settings</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">Theme & listening environment</h2>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {(['light', 'dark', 'paper'] as Theme[]).map((option) => {
            const active = option === theme
            const locked = option === 'paper' && !isPremium
            return (
              <button
                key={option}
                onClick={() => setTheme(option)}
                disabled={locked}
                className={`rounded-[24px] border px-4 py-4 text-left transition-colors ${
                  active
                    ? 'border-accent bg-accent/10'
                    : 'border-border/60 bg-background/20 hover:bg-foreground/5'
                } ${locked ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    {option === 'paper' ? <Scroll size={15} /> : <SunMoon size={15} />}
                    {THEME_LABELS[option]}
                  </span>
                  {locked ? <Lock size={14} className="text-muted-fg" /> : null}
                </div>
                <div className="mt-3 flex gap-2">
                  {THEME_SWATCHES[option].map((swatch) => (
                    <span
                      key={swatch}
                      className="h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: swatch }}
                    />
                  ))}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-fg">{THEME_DESCRIPTIONS[option]}</p>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
