'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { getClientDisplayMode } from '@/lib/client-display-mode'

const INTERVAL_MS = 5 * 60 * 1000
const MIN_REPEAT_MS = 45 * 1000

/**
 * Sends display-mode (PWA standalone vs browser) to the server for admin visibility.
 */
async function getNotificationAudit(): Promise<{
  notificationPermission?: string
  hasPushSubscription?: boolean
}> {
  if (typeof window === 'undefined') return {}
  const out: { notificationPermission?: string; hasPushSubscription?: boolean } = {}
  if ('Notification' in window) {
    const p = Notification.permission
    out.notificationPermission = p === 'default' ? 'default' : p === 'granted' ? 'granted' : 'denied'
  }
  try {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const reg = await navigator.serviceWorker.ready
      out.hasPushSubscription = !!(await reg.pushManager.getSubscription())
    }
  } catch {
    /* ignore */
  }
  return out
}

export function ClientDisplayReporter() {
  const { status } = useSession()
  const lastSentRef = useRef<{ sig: string; at: number } | null>(null)

  useEffect(() => {
    if (status !== 'authenticated') return

    const post = () => {
      void (async () => {
        const mode = getClientDisplayMode()
        const audit = await getNotificationAudit()
        const now = Date.now()
        const sig = `${mode}|${audit.notificationPermission ?? ''}|${audit.hasPushSubscription ?? ''}`
        const last = lastSentRef.current
        if (last && last.sig === sig && now - last.at < MIN_REPEAT_MS) return

        lastSentRef.current = { sig, at: now }
        void fetch('/api/user/client-display', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayMode: mode,
            ...audit
          }),
          keepalive: true
        }).catch(() => {})
      })()
    }

    post()
    const interval = window.setInterval(post, INTERVAL_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') post()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [status])

  return null
}
