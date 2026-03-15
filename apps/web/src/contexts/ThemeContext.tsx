import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useUserStore } from '../store/userStore'

export type Theme = 'light' | 'dark' | 'paper'

const STORAGE_KEY = 'myndral-theme'

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
  cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  cycleTheme: () => {},
})

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ThemeProvider({ children }: { children: ReactNode }) {
  const isPremium = useUserStore((s) => s.isPremium)
  const firstRender = useRef(true)

  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'dark') return 'dark'
    if (stored === 'paper') return 'paper'
    return 'light'
  })

  function setTheme(t: Theme) {
    // Paper mode is Premium-only; fall back to light
    const next = t === 'paper' && !isPremium ? 'light' : t
    setThemeState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  function cycleTheme() {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme(isPremium ? 'paper' : 'light')
    else setTheme('light')
  }

  // Apply data-theme attribute to <html>, animated via View Transitions API
  useEffect(() => {
    const root = document.documentElement

    const applyTheme = () => {
      if (theme === 'light') root.removeAttribute('data-theme')
      else root.setAttribute('data-theme', theme)
    }

    // Skip animation on first paint (restoring persisted theme on load)
    if (firstRender.current) {
      firstRender.current = false
      applyTheme()
      return
    }

    if (!('startViewTransition' in document) || prefersReducedMotion()) {
      applyTheme()
      return
    }

    // Signal the target theme for CSS to key the Minkowski animation off
    root.dataset.themeTarget = theme
    ;(document as Document & { startViewTransition: (cb: () => void) => { finished: Promise<void> } })
      .startViewTransition(applyTheme)
      .finished.finally(() => { delete root.dataset.themeTarget })
  }, [theme])

  // If user loses premium, drop paper theme
  useEffect(() => {
    if (!isPremium && theme === 'paper') setTheme('light')
  }, [isPremium]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Hook export is safe; keep it colocated with provider while silencing React Refresh rule.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext)
}
