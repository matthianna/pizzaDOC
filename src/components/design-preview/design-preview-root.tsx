'use client'

import { usePathname } from 'next/navigation'
import {
  DesignPreviewThemeProvider,
  type DesignVariant,
} from '@/components/design-preview/theme-provider'

function variantFromPath(pathname: string): DesignVariant {
  if (pathname.startsWith('/design-preview/linea')) return 'linea'
  if (pathname.startsWith('/design-preview/brace')) return 'brace'
  return 'fornace'
}

export function DesignPreviewRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const variant = variantFromPath(pathname)

  return (
    <DesignPreviewThemeProvider key={variant} variant={variant}>
      {children}
    </DesignPreviewThemeProvider>
  )
}
