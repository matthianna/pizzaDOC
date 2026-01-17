'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface NotificationContextType {
    unreadCount: number
    setUnreadCount: React.Dispatch<React.SetStateAction<number>>
    refreshUnreadCount: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession()
    const [unreadCount, setUnreadCount] = useState(0)
    const abortControllerRef = useRef<AbortController | null>(null)

    const refreshUnreadCount = useCallback(async () => {
        if (!session?.user?.id) return

        // Abort previous request if it's still pending
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        abortControllerRef.current = new AbortController()

        try {
            const response = await fetch('/api/notifications?limit=1', {
                signal: abortControllerRef.current.signal
            })
            
            if (response.ok) {
                const data = await response.json()
                setUnreadCount(data.unreadCount || 0)
            }
        } catch (error: any) {
            // Ignore abort errors and failed to fetch (usually network issues)
            if (error.name !== 'AbortError' && error.message !== 'Failed to fetch') {
                console.error('Error fetching unread count:', error)
            }
        } finally {
            abortControllerRef.current = null
        }
    }, [session?.user?.id])

    // Poll for new notifications every 30 seconds
    useEffect(() => {
        if (!session?.user?.id) {
            setUnreadCount(0)
            return
        }

        refreshUnreadCount()
        const interval = setInterval(refreshUnreadCount, 30000)

        return () => {
            clearInterval(interval)
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [session?.user?.id, refreshUnreadCount])

    // ⭐ App Badging API integration
    useEffect(() => {
        if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
            try {
                if (unreadCount > 0) {
                    (navigator as any).setAppBadge(unreadCount).catch((err: any) => {
                        // Silent fail for badge API
                    })
                } else {
                    (navigator as any).clearAppBadge().catch((err: any) => {
                        // Silent fail for badge API
                    })
                }
            } catch (e) {
                // Ignore errors from experimental API
            }
        }
    }, [unreadCount])

    return (
        <NotificationContext.Provider value={{ unreadCount, setUnreadCount, refreshUnreadCount }}>
            {children}
        </NotificationContext.Provider>
    )
}

export function useNotifications() {
    const context = useContext(NotificationContext)
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider')
    }
    return context
}
