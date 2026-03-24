'use client'

import { SessionProvider } from 'next-auth/react'
import { PWAInstallPrompt } from '@/components/pwa/install-prompt'
import { ClientDisplayReporter } from '@/components/pwa/client-display-reporter'
import { NotificationProvider } from '@/components/notifications/notification-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NotificationProvider>
        {children}
        <PWAInstallPrompt />
        <ClientDisplayReporter />
      </NotificationProvider>
    </SessionProvider>
  )
}

