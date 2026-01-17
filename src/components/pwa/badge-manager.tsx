'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function BadgeManager() {
    const pathname = usePathname()

    useEffect(() => {
        // Clear app badge when the user navigates or opens the app
        if ('clearAppBadge' in navigator) {
            (navigator as any).clearAppBadge().catch((err: any) => {
                console.error('Error clearing app badge:', err)
            })
        }
    }, [pathname])

    return null
}
