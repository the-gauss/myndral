import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getStoredString, setStoredString } from '@/src/lib/storage';
import { useAuthStore } from '@/src/stores/authStore';
import { DEFAULT_THEME, getTheme, THEME_OPTIONS, type AppTheme, type AppThemeName } from '@/src/theme';

const THEME_STORAGE_KEY = 'myndral.theme';

interface ThemeContextValue {
  themeName: AppThemeName;
  theme: AppTheme;
  options: typeof THEME_OPTIONS;
  setTheme: (next: AppThemeName) => Promise<void>;
  cycleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeName: DEFAULT_THEME,
  theme: getTheme(DEFAULT_THEME),
  options: THEME_OPTIONS,
  setTheme: async () => {},
  cycleTheme: async () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const isPremium = useAuthStore((state) => state.isPremium);
  const [themeName, setThemeName] = useState<AppThemeName>(DEFAULT_THEME);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateTheme() {
      const storedTheme = await getStoredString(THEME_STORAGE_KEY);
      if (isCancelled) {
        return;
      }

      if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'paper') {
        setThemeName(storedTheme);
      }
    }

    void hydrateTheme();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isPremium && themeName === 'paper') {
      void setStoredString(THEME_STORAGE_KEY, DEFAULT_THEME);
      setThemeName(DEFAULT_THEME);
    }
  }, [isPremium, themeName]);

  async function setTheme(nextTheme: AppThemeName) {
    const resolved = nextTheme === 'paper' && !isPremium ? DEFAULT_THEME : nextTheme;
    setThemeName(resolved);
    await setStoredString(THEME_STORAGE_KEY, resolved);
  }

  async function cycleTheme() {
    if (themeName === 'light') {
      await setTheme('dark');
      return;
    }

    if (themeName === 'dark') {
      await setTheme(isPremium ? 'paper' : 'light');
      return;
    }

    await setTheme('light');
  }

  return (
    <ThemeContext.Provider
      value={{
        themeName,
        theme: getTheme(themeName),
        options: THEME_OPTIONS,
        setTheme,
        cycleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
