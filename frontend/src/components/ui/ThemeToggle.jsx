import { Moon, Sun } from 'lucide-react'

import { useTheme } from '@/context/theme'
import { cn } from '@/utils/cn'

function ThemeToggle({ className }) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className={cn(
        'group relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
        className,
      )}
    >
      <Sun
        size={17}
        className={cn(
          'absolute transition duration-300',
          isDark
            ? 'rotate-0 scale-100 opacity-100'
            : 'rotate-90 scale-50 opacity-0',
        )}
      />
      <Moon
        size={17}
        className={cn(
          'absolute transition duration-300',
          isDark
            ? '-rotate-90 scale-50 opacity-0'
            : 'rotate-0 scale-100 opacity-100',
        )}
      />
    </button>
  )
}

export default ThemeToggle
