'use client'

import { useCallback } from 'react'

/**
 * Hook for haptic feedback on mobile devices using the Vibration API.
 */
export function useHaptics() {
    const vibrate = useCallback((pattern: number | number[] = 10) => {
        if (typeof window !== 'undefined' && navigator.vibrate) {
            try {
                navigator.vibrate(pattern)
            } catch (e) {
                // Ignore errors in browsers that don't support it or if blocked
            }
        }
    }, [])

    const lightClick = useCallback(() => vibrate(10), [vibrate])
    const mediumClick = useCallback(() => vibrate(20), [vibrate])
    const heavyClick = useCallback(() => vibrate(40), [vibrate])
    const success = useCallback(() => vibrate([10, 30, 10]), [vibrate])
    const error = useCallback(() => vibrate([50, 100, 50, 100, 50]), [vibrate])
    const warning = useCallback(() => vibrate([30, 100, 30]), [vibrate])

    return {
        vibrate,
        lightClick,
        mediumClick,
        heavyClick,
        success,
        error,
        warning
    }
}
