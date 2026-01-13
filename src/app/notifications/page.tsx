'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
    Bell,
    BellOff,
    CheckCheck,
    Calendar,
    Clock,
    ArrowLeftRight,
    AlertCircle,
    Loader2,
    Settings,
    Trash2,
    X
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { MainLayout } from '@/components/layout/main-layout'
import { usePushNotifications } from '@/components/notifications/notification-bell'

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

export default function NotificationsPage() {
    const { data: session } = useSession()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [hasMore, setHasMore] = useState(true)
    const [offset, setOffset] = useState(0)
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const [isDeletingAll, setIsDeletingAll] = useState(false)

    const { isSupported, isSubscribed, subscribe, unsubscribe, isLoading: pushLoading } = usePushNotifications()

    const fetchNotifications = async (reset = false) => {
        if (!session?.user?.id) return

        try {
            const currentOffset = reset ? 0 : offset
            const response = await fetch(`/api/notifications?limit=20&offset=${currentOffset}`)
            if (response.ok) {
                const data = await response.json()
                if (reset) {
                    setNotifications(data.notifications)
                    setOffset(20)
                } else {
                    setNotifications(prev => [...prev, ...data.notifications])
                    setOffset(prev => prev + 20)
                }
                setHasMore(data.notifications.length === 20)
            }
        } catch (error) {
            console.error('Error fetching notifications:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchNotifications(true)
    }, [session?.user?.id])

    const markAsRead = async (notificationId: string) => {
        try {
            await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' })
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
            )
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
        } catch (error) {
            console.error('Error marking all as read:', error)
        }
    }

    const deleteNotification = async (e: React.MouseEvent, notificationId: string) => {
        e.stopPropagation()
        setIsDeleting(notificationId)
        try {
            const response = await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE' })
            if (response.ok) {
                setNotifications(prev => prev.filter(n => n.id !== notificationId))
            }
        } catch (error) {
            console.error('Error deleting notification:', error)
        } finally {
            setIsDeleting(null)
        }
    }

    const deleteAllNotifications = async () => {
        if (!confirm('Sei sicuro di voler eliminare tutte le notifiche? Questa azione è irreversibile.')) return

        setIsDeletingAll(true)
        try {
            const response = await fetch('/api/notifications', { method: 'DELETE' })
            if (response.ok) {
                setNotifications([])
                setHasMore(false)
            }
        } catch (error) {
            console.error('Error deleting all notifications:', error)
        } finally {
            setIsDeletingAll(false)
        }
    }

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.isRead) {
            markAsRead(notification.id)
        }
        setSelectedNotification(notification)
    }

    const handleGoToLink = (url: string) => {
        window.location.href = url
    }

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'SCHEDULE_PUBLISHED':
            case 'SHIFT_ASSIGNED':
            case 'SHIFT_CHANGED':
            case 'SHIFT_REMOVED':
                return <Calendar className="h-6 w-6 text-blue-500" />
            case 'HOURS_APPROVED':
            case 'HOURS_REJECTED':
            case 'HOURS_REMINDER':
                return <Clock className="h-6 w-6 text-orange-500" />
            case 'SUBSTITUTION_REQUEST':
            case 'SUBSTITUTION_APPLIED':
            case 'SUBSTITUTION_APPROVED':
            case 'SUBSTITUTION_REJECTED':
                return <ArrowLeftRight className="h-6 w-6 text-purple-500" />
            case 'AVAILABILITY_REMINDER':
                return <AlertCircle className="h-6 w-6 text-yellow-500" />
            default:
                return <Bell className="h-6 w-6 text-gray-500" />
        }
    }

    return (
        <MainLayout>
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <Bell className="h-7 w-7 text-orange-600" />
                                Centro Notifiche
                            </h1>
                            <p className="text-gray-500 mt-1">
                                Gestisci le tue notifiche e preferenze
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {notifications.length > 0 && (
                                <button
                                    onClick={deleteAllNotifications}
                                    disabled={isDeletingAll}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                                >
                                    {isDeletingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    Elimina tutte
                                </button>
                            )}
                            {notifications.some(n => !n.isRead) && (
                                <button
                                    onClick={markAllAsRead}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors"
                                >
                                    <CheckCheck className="h-4 w-4" />
                                    Segna tutte lette
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Push Notification Settings */}
                    {isSupported && (
                        <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-2 rounded-lg",
                                    isSubscribed ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-600"
                                )}>
                                    <Settings className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">Notifiche Push</p>
                                    <p className="text-sm text-gray-500">
                                        {isSubscribed
                                            ? "Le notifiche push sono attive su questo dispositivo"
                                            : "Attiva le notifiche per non perdere aggiornamenti importanti"}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={isSubscribed ? unsubscribe : subscribe}
                                disabled={pushLoading}
                                className={cn(
                                    "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2",
                                    isSubscribed ? 'bg-orange-600' : 'bg-gray-200',
                                    pushLoading && 'opacity-50 cursor-not-allowed'
                                )}
                            >
                                <span
                                    className={cn(
                                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                        isSubscribed ? 'translate-x-5' : 'translate-x-0'
                                    )}
                                />
                            </button>
                        </div>
                    )}
                </div>

                {/* Notifications List */}
                <div className="space-y-4">
                    {loading && notifications.length === 0 ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                            <BellOff className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-gray-900">Nessuna notifica</h3>
                            <p className="text-gray-500">Non hai nuove notifiche al momento</p>
                        </div>
                    ) : (
                        <>
                            {notifications.map(notification => (
                                <button
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={cn(
                                        "w-full text-left bg-white p-4 rounded-xl shadow-sm border transition-all hover:shadow-md",
                                        notification.isRead
                                            ? "border-gray-100"
                                            : "border-orange-200 bg-orange-50/30"
                                    )}
                                >
                                    <div className="flex gap-4">
                                        <div className={cn(
                                            "flex-shrink-0 p-3 rounded-full h-fit",
                                            notification.isRead ? "bg-gray-100" : "bg-white shadow-sm ring-1 ring-gray-200"
                                        )}>
                                            {getNotificationIcon(notification.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <h4 className={cn(
                                                    "text-base",
                                                    notification.isRead ? "font-medium text-gray-900" : "font-bold text-gray-900"
                                                )}>
                                                    {notification.title}
                                                </h4>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-gray-500 whitespace-nowrap mt-1">
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
                                                    </span>
                                                    <button
                                                        onClick={(e) => deleteNotification(e, notification.id)}
                                                        disabled={isDeleting === notification.id}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        {isDeleting === notification.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-gray-600 mt-1 line-clamp-2">
                                                {notification.body}
                                            </p>
                                        </div>
                                        {!notification.isRead && (
                                            <div className="flex-shrink-0 self-center">
                                                <span className="block h-3 w-3 rounded-full bg-orange-500 ring-4 ring-orange-100" />
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}

                            {hasMore && (
                                <button
                                    onClick={() => fetchNotifications()}
                                    disabled={loading}
                                    className="w-full py-4 text-center text-orange-600 font-medium bg-white rounded-xl border border-gray-200 hover:bg-orange-50 transition-colors"
                                >
                                    {loading ? (
                                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                    ) : (
                                        'Carica notifiche precedenti'
                                    )}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Notification Detail Modal */}
            {selectedNotification && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-50 to-white">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-white rounded-2xl shadow-sm ring-1 ring-gray-200">
                                    {getNotificationIcon(selectedNotification.type)}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{selectedNotification.title}</h3>
                                    <p className="text-xs text-gray-500">
                                        {(() => {
                                            try {
                                                const date = new Date(selectedNotification.sentAt)
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
                            </div>
                            <button
                                onClick={() => setSelectedNotification(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-8">
                            <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap">
                                {selectedNotification.body as string}
                            </p>

                            {typeof selectedNotification.data?.url === 'string' && (
                                <button
                                    onClick={() => handleGoToLink(selectedNotification.data?.url as string)}
                                    className="w-full mt-8 py-4 bg-gradient-primary text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 hover:brightness-110 transition-all transform active:scale-95 flex items-center justify-center gap-2"
                                >
                                    Vai alla pagina
                                    <ArrowLeftRight className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                        <div className="p-4 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setSelectedNotification(null)}
                                className="px-6 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                Chiudi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    )
}
