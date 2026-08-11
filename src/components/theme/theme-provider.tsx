'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type AppTheme = 'light' | 'dark'

type ThemeContextValue = {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'pizzadoc-theme'

function applyThemeToDocument(theme: AppTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#14110f' : '#EA580C')
  }
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('light')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as AppTheme | null
      const initial = stored === 'dark' || stored === 'light' ? stored : 'light'
      setThemeState(initial)
      applyThemeToDocument(initial)
    } catch {
      applyThemeToDocument('light')
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    applyThemeToDocument(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme, ready])

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useAppTheme must be used within AppThemeProvider')
  }
  return ctx
}
