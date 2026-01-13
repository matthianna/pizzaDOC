'use client'

import { SessionProvider } from 'next-auth/react'
import { PWAInstallPrompt } from '@/components/pwa/install-prompt'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <PWAInstallPrompt />
    </SessionProvider>
  )
}

