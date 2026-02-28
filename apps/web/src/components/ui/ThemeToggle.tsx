import { Moon, Scroll, Sun } from 'lucide-react'
import { useTheme, type Theme } from '../../contexts/ThemeContext'
import { useUserStore } from '../../store/userStore'

const icons: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  paper: Scroll,
}

export default function ThemeToggle() {
  const { theme, cycleTheme } = useTheme()
  const isPremium = useUserStore((s) => s.isPremium)
  const Icon = icons[theme]

  return (
    <button
      onClick={cycleTheme}
      title={isPremium ? 'Cycle theme (light / dark / paper)' : 'Cycle theme (light / dark)'}
      className="p-2 rounded-full text-muted-fg hover:text-foreground hover:bg-surface transition-colors"
    >
      <Icon size={18} />
    </button>
  )
}
