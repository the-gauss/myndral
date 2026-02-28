import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const isPremium = useUserStore((s) => s.isPremium)

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

  // Apply data-theme attribute to <html>
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
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

export function useTheme() {
  return useContext(ThemeContext)
}
