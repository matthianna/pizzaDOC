'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
    Bell,
    BellOff,
    Check,
    CheckCheck,
    Calendar,
    Clock,
    ArrowLeftRight,
    AlertCircle,
    X,
    Loader2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useNotifications } from './notification-provider'

interface Notification {
    id: string
    type: string
    title: string
    body: string
    data?: Record<string, unknown>
    isRead: boolean
    sentAt: string
    readAt?: string
}

export function NotificationBell({ iconClassName }: { iconClassName?: string }) {
    const { data: session } = useSession()
    const { unreadCount, setUnreadCount, refreshUnreadCount } = useNotifications()
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(false)
    const [hasMore, setHasMore] = useState(true)

    const fetchNotifications = useCallback(async (reset = false) => {
        if (!session?.user?.id) return

        setLoading(true)
        try {
            const offset = reset ? 0 : notifications.length
            const response = await fetch(`/api/notifications?limit=10&offset=${offset}`)
            if (response.ok) {
                const data = await response.json()
                if (reset) {
                    setNotifications(data.notifications)
                } else {
                    setNotifications(prev => [...prev, ...data.notifications])
                }
                setUnreadCount(data.unreadCount)
                setHasMore(data.notifications.length === 10)
            }
        } catch (error) {
            console.error('Error fetching notifications:', error)
        } finally {
            setLoading(false)
        }
    }, [session?.user?.id, notifications.length, setUnreadCount])

    // Initial fetch
    useEffect(() => {
        if (session?.user?.id && isOpen) {
            fetchNotifications(true)
        }
    }, [session?.user?.id, isOpen, fetchNotifications])

    // Remove local App Badging and Polling as they are now handled by NotificationProvider

    const markAsRead = async (notificationId: string) => {
        try {
            await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' })
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
            )
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch (error) {
            console.error('Error marking notification as read:', error)
        }
    }

    const markAllAsRead = async () => {
        try {
            await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'markAllRead' })
            })
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
            setUnreadCount(0)
        } catch (error) {
            console.error('Error marking all as read:', error)
        }
    }

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.isRead) {
            markAsRead(notification.id)
        }

        // Navigate to the relevant page if data contains a URL
        const url = notification.data?.url as string | undefined
        if (url) {
            window.location.href = url
            setIsOpen(false)
        }
    }

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'SCHEDULE_PUBLISHED':
            case 'SHIFT_ASSIGNED':
            case 'SHIFT_CHANGED':
            case 'SHIFT_REMOVED':
                return <Calendar className="h-5 w-5 text-blue-500" />
            case 'HOURS_APPROVED':
            case 'HOURS_REJECTED':
            case 'HOURS_REMINDER':
                return <Clock className="h-5 w-5 text-orange-500" />
            case 'SUBSTITUTION_REQUEST':
            case 'SUBSTITUTION_APPLIED':
            case 'SUBSTITUTION_APPROVED':
            case 'SUBSTITUTION_REJECTED':
                return <ArrowLeftRight className="h-5 w-5 text-purple-500" />
            case 'AVAILABILITY_REMINDER':
                return <AlertCircle className="h-5 w-5 text-yellow-500" />
            default:
                return <Bell className="h-5 w-5 text-gray-500" />
        }
    }

    if (!session?.user?.id) return null

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Notifiche"
            >
                <Bell className={cn("h-6 w-6", iconClassName || "text-gray-600")} />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Panel */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[90]"
                        onClick={() => setIsOpen(false)}
                    />

                        {/* Panel */}
                        <div className="absolute left-0 top-12 w-80 sm:w-96 max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Bell className="h-5 w-5" />
                                Notifiche
                            </h3>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-full transition-colors"
                                    >
                                        <CheckCheck className="h-4 w-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-white/20 rounded-full transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Notifications List */}
                        <div className="max-h-[60vh] overflow-y-auto">
                            {notifications.length === 0 && !loading ? (
                                <div className="py-12 text-center">
                                    <BellOff className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm">Nessuna notifica</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {notifications.map(notification => (
                                        <button
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={cn(
                                                'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex gap-3',
                                                !notification.isRead && 'bg-orange-50/50'
                                            )}
                                        >
                                            <div className="flex-shrink-0 mt-0.5">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={cn(
                                                        'text-sm line-clamp-1',
                                                        notification.isRead ? 'text-gray-700' : 'text-gray-900 font-semibold'
                                                    )}>
                                                        {notification.title}
                                                    </p>
                                                    {!notification.isRead && (
                                                        <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">
                                                    {notification.body}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {(() => {
                                                        try {
                                                            const date = new Date(notification.sentAt)
                                                            if (isNaN(date.getTime())) return ''
                                                            return formatDistanceToNow(date, {
                                                                addSuffix: true,
                                                                locale: it
                                                            })
                                                        } catch {
                                                            return ''
                                                        }
                                                    })()}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Load More */}
                            {hasMore && notifications.length > 0 && (
                                <button
                                    onClick={() => fetchNotifications()}
                                    disabled={loading}
                                    className="w-full py-3 text-sm text-orange-600 hover:bg-orange-50 transition-colors disabled:opacity-50"
                                >
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                    ) : (
                                        'Carica altre'
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-gray-100 px-4 py-2">
                            <a
                                href="/notifications"
                                className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                            >
                                Vedi tutte le notifiche →
                            </a>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

// Hook for push notification subscription
export function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false)
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Check if push notifications are supported
        const supported = 'serviceWorker' in navigator && 'PushManager' in window
        setIsSupported(supported)

        if (supported) {
            checkSubscription()
        }
    }, [])

    const checkSubscription = async () => {
        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()
            setIsSubscribed(!!subscription)
        } catch (err) {
            console.error('Error checking subscription:', err)
        }
    }

    const subscribe = async () => {
        if (!isSupported) {
            setError('Push notifications non supportate')
            return false
        }

        setIsLoading(true)
        setError(null)

        try {
            // Get VAPID public key
            const keyResponse = await fetch('/api/push/vapid-key')
            if (!keyResponse.ok) {
                throw new Error('Notifiche push non configurate')
            }
            const { publicKey } = await keyResponse.json()

            // Request notification permission
            const permission = await Notification.requestPermission()
            if (permission !== 'granted') {
                throw new Error('Permesso notifiche negato')
            }

            // Get push subscription
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey) as any
            })

            // Send subscription to server
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription })
            })

            if (!response.ok) {
                throw new Error('Errore durante la sottoscrizione')
            }

            setIsSubscribed(true)
            return true
        } catch (err) {
            console.error('Error subscribing to push:', err)
            setError(err instanceof Error ? err.message : 'Errore sconosciuto')
            return false
        } finally {
            setIsLoading(false)
        }
    }

    const unsubscribe = async () => {
        setIsLoading(true)
        setError(null)

        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()

            if (subscription) {
                await subscription.unsubscribe()

                // Notify server
                await fetch('/api/push/subscribe', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: subscription.endpoint })
                })
            }

            setIsSubscribed(false)
            return true
        } catch (err) {
            console.error('Error unsubscribing from push:', err)
            setError(err instanceof Error ? err.message : 'Errore sconosciuto')
            return false
        } finally {
            setIsLoading(false)
        }
    }

    return {
        isSupported,
        isSubscribed,
        isLoading,
        error,
        subscribe,
        unsubscribe
    }
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}
