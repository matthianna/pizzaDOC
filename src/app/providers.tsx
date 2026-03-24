'use client'

import { SessionProvider } from 'next-auth/react'
import { PWAInstallPrompt } from '@/components/pwa/install-prompt'
import { NotificationProvider } from '@/components/notifications/notification-provider'
import { NotificationPermissionPrompt } from '@/components/notifications/notification-permission-prompt'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NotificationProvider>
        {children}
        <PWAInstallPrompt />
        <NotificationPermissionPrompt />
      </NotificationProvider>
    </SessionProvider>
  )
}

