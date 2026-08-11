'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type PreviewTheme = 'light' | 'dark'
export type DesignVariant = 'fornace' | 'linea' | 'brace'

type ThemeContextValue = {
  theme: PreviewTheme
  setTheme: (theme: PreviewTheme) => void
  toggleTheme: () => void
  variant: DesignVariant
  basePath: string
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const VARIANT_CLASS: Record<DesignVariant, string> = {
  fornace: 'design-preview',
  linea: 'design-preview design-preview--linea',
  brace: 'design-preview design-preview--brace',
}

const VARIANT_BASE: Record<DesignVariant, string> = {
  fornace: '/design-preview',
  linea: '/design-preview/linea',
  brace: '/design-preview/brace',
}

export function DesignPreviewThemeProvider({
  children,
  variant = 'fornace',
}: {
  children: ReactNode
  variant?: DesignVariant
}) {
  const storageKey = `pizzadoc-design-preview-theme-${variant}`
  const [theme, setThemeState] = useState<PreviewTheme>('light')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey) as PreviewTheme | null
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored)
      } else {
        setThemeState('light')
      }
    } catch {
      /* ignore */
    }
    setReady(true)
  }, [storageKey])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(storageKey, theme)
    } catch {
      /* ignore */
    }
  }, [theme, ready, storageKey])

  const setTheme = useCallback((next: PreviewTheme) => {
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      variant,
      basePath: VARIANT_BASE[variant],
    }),
    [theme, setTheme, toggleTheme, variant]
  )

  return (
    <ThemeContext.Provider value={value}>
      <div
        className={VARIANT_CLASS[variant]}
        data-theme={theme}
        data-variant={variant}
        style={{ colorScheme: theme }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export function useDesignPreviewTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useDesignPreviewTheme must be used within DesignPreviewThemeProvider')
  }
  return ctx
}
