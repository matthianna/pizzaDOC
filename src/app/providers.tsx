'use client'

import { SessionProvider } from 'next-auth/react'
import { PWAInstallPrompt } from '@/components/pwa/install-prompt'
import { NotificationProvider } from '@/components/notifications/notification-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NotificationProvider>
        {children}
        <PWAInstallPrompt />
      </NotificationProvider>
    </SessionProvider>
  )
}

