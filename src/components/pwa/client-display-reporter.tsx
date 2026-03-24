'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { getClientDisplayMode } from '@/lib/client-display-mode'

const INTERVAL_MS = 5 * 60 * 1000
const MIN_REPEAT_MS = 45 * 1000

/**
 * Sends display-mode (PWA standalone vs browser) to the server for admin visibility.
 */
export function ClientDisplayReporter() {
  const { status } = useSession()
  const lastSentRef = useRef<{ mode: string; at: number } | null>(null)

  useEffect(() => {
    if (status !== 'authenticated') return

    const post = () => {
      const mode = getClientDisplayMode()
      const now = Date.now()
      const last = lastSentRef.current
      if (last && last.mode === mode && now - last.at < MIN_REPEAT_MS) return

      lastSentRef.current = { mode, at: now }
      void fetch('/api/user/client-display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayMode: mode }),
        keepalive: true
      }).catch(() => {})
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
