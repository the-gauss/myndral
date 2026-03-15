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
  const [minkowskiHinted, setMinkowskiHinted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const Icon = icons[theme]

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setMinkowskiHinted(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleMinkowskiClick() {
    if (isPremium) {
      setTheme('paper')
      setOpen(false)
    } else {
      setMinkowskiHinted(h => !h)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Change theme"
        className="p-2 rounded-full text-muted-fg hover:text-foreground hover:bg-surface transition-colors"
      >
        <Icon size={18} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-surface border border-border rounded-md shadow-md overflow-hidden z-50">

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
                    : 'text-foreground hover:bg-border/40'
                  }`}
              >
                <TIcon size={14} className="shrink-0" />
                {labels[t]}
              </button>
            )
          })}

          {/* Divider before premium */}
          <div className="mx-3 border-t border-border/60" />

          {/* Minkowski — always visible, locked for free users */}
          <button
            onClick={handleMinkowskiClick}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors group
              ${isPremium && theme === 'paper'
                ? 'text-accent bg-accent/10 font-medium'
                : isPremium
                  ? 'text-foreground hover:bg-border/40'
                  : 'hover:bg-[rgba(196,149,106,0.08)]'
              }`}
          >
            {isPremium
              ? <Scroll size={14} className="shrink-0" />
              : <Lock size={14} className="shrink-0 text-[#c4956a] group-hover:text-[#8c3d2e] transition-colors" />
            }
            <span className={isPremium ? '' : 'text-[#7a5c42] group-hover:text-[#3d2b1a] transition-colors font-medium'}>
              Minkowski
            </span>
            {isPremium
              ? (theme === 'paper' ? null : <MinkowskiSwatches />)
              : <MinkowskiSwatches />
            }
          </button>

          {/* Inline upgrade nudge — revealed on click for free users */}
          {!isPremium && minkowskiHinted && (
            <div
              className="mx-2 mb-2 px-3 py-2.5 rounded text-[11px] leading-relaxed"
              style={{
                background: 'linear-gradient(135deg, rgba(253,245,236,0.15) 0%, rgba(196,149,106,0.12) 100%)',
                border: '1px solid rgba(196,149,106,0.25)',
                color: '#a88c70',
              }}
            >
              <p className="font-medium mb-0.5" style={{ color: '#7a5c42' }}>
                A world of warm light.
              </p>
              Ivory, parchment & burgundy.
              Exclusive to Premium.
            </div>
          )}

        </div>
      )}
    </div>
  )
}
