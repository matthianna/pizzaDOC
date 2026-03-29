'use client'

import { SessionProvider } from 'next-auth/react'
import { ClientDisplayReporter } from '@/components/pwa/client-display-reporter'
import { NotificationProvider } from '@/components/notifications/notification-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NotificationProvider>
        {children}
        <ClientDisplayReporter />
      </NotificationProvider>
    </SessionProvider>
  )
}

