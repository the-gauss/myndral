import { useEffect, useRef, useState } from 'react'
import { Moon, Scroll, Sun } from 'lucide-react'
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

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isPremium = useUserStore((s) => s.isPremium)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const Icon = icons[theme]

  const visibleThemes = isPremium ? ALL_THEMES : ALL_THEMES.filter(t => t !== 'paper')

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
        className="p-2 rounded-full text-muted-fg hover:text-foreground hover:bg-surface transition-colors"
      >
        <Icon size={18} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-surface border border-border rounded-md shadow-md overflow-hidden z-50">
          {visibleThemes.map(t => {
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
                {t === 'paper' && (
                  <span className="ml-auto text-[10px] text-muted-fg leading-none">Premium</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
