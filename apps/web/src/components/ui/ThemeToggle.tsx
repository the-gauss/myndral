import { useEffect, useRef, useState } from 'react'
import { Lock, Moon, Scroll, Sun } from 'lucide-react'
import { useTheme, type Theme } from '../../contexts/ThemeContext'
import { useUserStore } from '../../store/userStore'

const icons: Record<Theme, typeof Sun> = {
  light: Sun,
  dark:  Moon,
  paper: Scroll,
}

const labels: Record<Theme, string> = {
  light: 'Light',
  dark:  'Dark',
  paper: 'Minkowski',
}

const ALL_THEMES: Theme[] = ['light', 'dark', 'paper']

/** Tiny palette swatch dots that hint at the Minkowski colour story */
function MinkowskiSwatches() {
  return (
    <span className="ml-auto flex items-center gap-0.5">
      {['#fdf5ec', '#eddfc8', '#c4956a', '#722f37'].map(c => (
        <span
          key={c}
          style={{ background: c }}
          className="w-2 h-2 rounded-full border border-black/10"
        />
      ))}
    </span>
  )
}

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isPremium = useUserStore((s) => s.isPremium)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const Icon = icons[theme]

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Change theme"
        className="glass-pill p-2 text-muted-fg hover:text-foreground"
      >
        <Icon size={18} />
      </button>

      {open && (
        <div className="glass-panel-strong absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl">

          {/* Free themes */}
          {ALL_THEMES.filter(t => t !== 'paper').map(t => {
            const TIcon = icons[t]
            const active = theme === t
            return (
              <button
                key={t}
                onClick={() => { setTheme(t); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors
                  ${active
                  ? 'text-accent bg-accent/10 font-medium'
                  : 'text-foreground hover:bg-foreground/5'
                  }`}
              >
                <TIcon size={14} className="shrink-0" />
                {labels[t]}
              </button>
            )
          })}

          {/* Divider before premium */}
          <div className="mx-3 border-t border-border/60" />

          {/* Minkowski — always visible, locked for non-premium users */}
          <button
            onClick={isPremium ? () => { setTheme('paper'); setOpen(false) } : undefined}
            disabled={!isPremium}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors
              ${isPremium && theme === 'paper'
                ? 'text-accent bg-accent/10 font-medium'
                : isPremium
                  ? 'text-foreground hover:bg-foreground/5'
                  : 'opacity-60 cursor-not-allowed'
              }`}
          >
            {isPremium
              ? <Scroll size={14} className="shrink-0" />
              : <Lock size={14} className="shrink-0 text-[#c4956a]" />
            }
            <span className={isPremium ? '' : 'text-[#7a5c42] font-medium'}>
              Minkowski
            </span>
            {isPremium
              ? (theme === 'paper' ? null : <MinkowskiSwatches />)
              : (
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#c4956a' }}>
                  Premium
                </span>
              )
            }
          </button>

        </div>
      )}
    </div>
  )
}
