export type PushSetupGap = 'none' | 'denied' | 'request' | 'subscribe'

/**
 * Client-side: what is missing for fully working web push (permission + subscription).
 */
export async function detectPushSetupGap(): Promise<PushSetupGap> {
  if (typeof window === 'undefined' || !window.isSecureContext) return 'none'
  if (!('Notification' in window)) return 'none'

  const perm = Notification.permission
  if (perm === 'denied') return 'denied'
  if (perm === 'default') return 'request'

  if (perm !== 'granted') return 'none'
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'none'

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return 'subscribe'
  } catch {
    return 'subscribe'
  }

  return 'none'
}
