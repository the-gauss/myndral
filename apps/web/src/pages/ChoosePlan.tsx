import { Check, Lock } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ui/ThemeToggle'
import type { AuthResponse } from '../services/auth'
import { useUserStore } from '../store/userStore'

// ─────────────────────────────────────────────────────────────────────────────
// Plan definitions — feature lists are intentionally forward-looking to
// communicate the product vision even while premium is gated behind "coming soon".
// ─────────────────────────────────────────────────────────────────────────────

interface Plan {
  key: string
  name: string
  price: string
  period: string
  badge?: string
  description: string
  features: string[]
  cta: string
  comingSoon: boolean
}

const PLANS: Plan[] = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Everything you need to explore AI music.',
    features: [
      'Full catalog access',
      'Ad-free listening',
      'Create unlimited playlists',
      'Standard audio quality',
    ],
    cta: 'Continue with Free',
    comingSoon: false,
  },
  {
    key: 'premium_monthly',
    name: 'Premium',
    price: '$4.99',
    period: 'per month',
    description: 'The full experience, unlocked.',
    features: [
      'Everything in Free',
      'High-fidelity audio',
      'Paper theme',
      'Download for offline listening',
      'Priority track generation requests',
    ],
    cta: 'Get Premium',
    comingSoon: true,
  },
  {
    key: 'premium_annual',
    name: 'Premium Annual',
    price: '$39.99',
    period: 'per year',
    badge: 'Best Value',
    description: 'Two months free compared to monthly.',
    features: [
      'Everything in Premium',
      '2 months free vs. monthly',
      'Early access to new features',
    ],
    cta: 'Get Annual',
    comingSoon: true,
  },
]

// ─────────────────────────────────────────────────────────────────────────────

interface LocationState {
  auth: AuthResponse
}

export default function ChoosePlan() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const setUser   = useUserStore((s) => s.setUser)

  const state = location.state as LocationState | null

  // Guard: if someone lands here without going through registration
  // (e.g. direct URL), send them back to register.
  useEffect(() => {
    if (!state?.auth) {
      navigate('/register', { replace: true })
    }
  }, [state, navigate])

  if (!state?.auth) return null

  function handleSelectFree() {
    const { user, accessToken } = state!.auth
    setUser(user, accessToken)
    // App.tsx detects isAuthenticated and renders the main layout;
    // navigation to "/" is handled by the route redirect there.
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-fg">MyndralAI</p>
          <h1 className="mt-3 text-3xl font-bold">Choose your plan</h1>
          <p className="mt-2 text-sm text-muted-fg">
            You can upgrade any time. No commitments.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              onSelectFree={handleSelectFree}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: Plan
  onSelectFree: () => void
}

function PlanCard({ plan, onSelectFree }: PlanCardProps) {
  const isFeatured = plan.key === 'premium_annual'

  return (
    <div
      className={[
        'relative flex flex-col rounded-2xl border p-6 transition',
        isFeatured
          ? 'border-accent/40 bg-accent/5 shadow-lg'
          : 'border-border bg-surface/60',
        plan.comingSoon ? 'opacity-70' : '',
      ].join(' ')}
    >
      {/* "Best Value" badge */}
      {plan.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-fg">
          {plan.badge}
        </span>
      )}

      {/* Plan name + coming-soon pill */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold uppercase tracking-wide">{plan.name}</span>
        {plan.comingSoon && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-fg">
            Coming soon
          </span>
        )}
      </div>

      {/* Price */}
      <div className="mt-4">
        <span className="text-4xl font-bold">{plan.price}</span>
        <span className="ml-1.5 text-sm text-muted-fg">{plan.period}</span>
      </div>

      {/* Description */}
      <p className="mt-2 text-sm text-muted-fg">{plan.description}</p>

      {/* Divider */}
      <hr className="my-5 border-border" />

      {/* Feature list */}
      <ul className="flex-1 space-y-2.5">
        {plan.features.map((feat) => (
          <li key={feat} className="flex items-start gap-2 text-sm">
            <Check size={14} className="mt-0.5 shrink-0 text-accent" />
            <span>{feat}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="mt-6">
        {plan.comingSoon ? (
          <button
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-semibold text-muted-fg cursor-not-allowed"
          >
            <Lock size={13} />
            Coming soon
          </button>
        ) : (
          <button
            onClick={onSelectFree}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition hover:opacity-95"
          >
            {plan.cta}
          </button>
        )}
      </div>
    </div>
  )
}
