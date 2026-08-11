'use client'

import { Moon, Sun } from 'lucide-react'
import { useDesignPreviewTheme } from './theme-provider'
import { cn } from '@/lib/utils'

type ThemeToggleProps = {
  className?: string
  compact?: boolean
}

export function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const { theme, setTheme } = useDesignPreviewTheme()

  return (
    <div
      role="group"
      aria-label="Tema"
      className={cn(
        'inline-flex items-center rounded-full border p-1',
        className
      )}
      style={{
        borderColor: 'var(--pd-border)',
        background: 'var(--pd-surface)',
      }}
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        aria-pressed={theme === 'light'}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors pd-press',
          compact && 'px-2.5'
        )}
        style={{
          background: theme === 'light' ? 'var(--pd-accent-soft)' : 'transparent',
          color: theme === 'light' ? 'var(--pd-accent)' : 'var(--pd-muted)',
        }}
      >
        <Sun className="h-3.5 w-3.5" aria-hidden />
        {!compact && <span>Chiaro</span>}
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        aria-pressed={theme === 'dark'}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors pd-press',
          compact && 'px-2.5'
        )}
        style={{
          background: theme === 'dark' ? 'var(--pd-accent-soft)' : 'transparent',
          color: theme === 'dark' ? 'var(--pd-accent)' : 'var(--pd-muted)',
        }}
      >
        <Moon className="h-3.5 w-3.5" aria-hidden />
        {!compact && <span>Scuro</span>}
      </button>
    </div>
  )
}
