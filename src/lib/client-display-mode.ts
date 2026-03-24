export type ClientDisplayMode = 'standalone' | 'fullscreen' | 'browser'

/**
 * Detect how the app is currently shown (PWA vs browser tab).
 * Safe to call only in the browser.
 */
export function getClientDisplayMode(): ClientDisplayMode {
  if (typeof window === 'undefined') return 'browser'
  const nav = window.navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return 'standalone'
  if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone'
  if (window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen'
  return 'browser'
}
