'use client'

import { SessionProvider } from 'next-auth/react'
import { ClientDisplayReporter } from '@/components/pwa/client-display-reporter'
import { NotificationProvider } from '@/components/notifications/notification-provider'
import { AppThemeProvider } from '@/components/theme/theme-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider>
      <SessionProvider>
        <NotificationProvider>
          {children}
          <ClientDisplayReporter />
        </NotificationProvider>
      </SessionProvider>
    </AppThemeProvider>
  )
}
