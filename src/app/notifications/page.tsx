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
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { MainLayout } from '@/components/layout/main-layout'
import { StaffPageHeader } from '@/components/layout/staff-page-header'
import { usePushNotifications } from '@/components/notifications/notification-bell'
import { useNotifications } from '@/components/notifications/notification-provider'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'

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
    const { setUnreadCount } = useNotifications()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [hasMore, setHasMore] = useState(true)
    const [offset, setOffset] = useState(0)
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const [isDeletingAll, setIsDeletingAll] = useState(false)
    const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)

    const isUserAdmin = session?.user?.roles?.includes('ADMIN')

    const resolveNotificationLink = (n: Notification): string | null => {
        const u = n.data?.url
        if (typeof u === 'string' && u.startsWith('/')) return u
        if (n.type === 'HOURS_REMINDER') return isUserAdmin ? '/admin/hours' : '/hours'
        return null
    }

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

    const deleteNotification = async (e: React.MouseEvent, notificationId: string) => {
        e.stopPropagation()
        const notification = notifications.find(n => n.id === notificationId)
        setIsDeleting(notificationId)
        try {
            const response = await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE' })
            if (response.ok) {
                if (notification && !notification.isRead) {
                    setUnreadCount(prev => Math.max(0, prev - 1))
                }
                setNotifications(prev => prev.filter(n => n.id !== notificationId))
            }
        } catch (error) {
            console.error('Error deleting notification:', error)
        } finally {
            setIsDeleting(null)
        }
    }

    const deleteAllNotifications = async () => {
        setIsDeletingAll(true)
        try {
            const response = await fetch('/api/notifications', { method: 'DELETE' })
            if (response.ok) {
                setNotifications([])
                setUnreadCount(0)
                setHasMore(false)
            }
        } catch (error) {
            console.error('Error deleting all notifications:', error)
            throw error
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
                return <ArrowLeftRight className="h-6 w-6 text-[var(--pd-accent)]" />
                case 'AVAILABILITY_REMINDER':
                    return <AlertCircle className="h-6 w-6 text-yellow-500" />
                case 'ABSENCE_REQUESTED':
                case 'ABSENCE_APPROVED':
                case 'ABSENCE_REJECTED':
                    return <Calendar className="h-6 w-6 text-red-500" />
                default:
                    return <Bell className="h-6 w-6 text-gray-500" />
        }
    }

    return (
        <MainLayout>
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="pd-card p-6">
                    <StaffPageHeader
                        title="Notifiche"
                        subtitle="Gestisci le tue notifiche e preferenze"
                        action={
                        <div className="flex items-center gap-3 flex-wrap">
                            {notifications.length > 0 && (
                                <button
                                    onClick={() => setShowDeleteAllConfirm(true)}
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
                        }
                    />

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
                                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2',
                                    !isSubscribed && 'bg-gray-200',
                                    pushLoading && 'opacity-50 cursor-not-allowed'
                                )}
                                style={isSubscribed ? { background: 'var(--pd-accent)' } : undefined}
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
                        <div className="text-center py-12 pd-card">
                            <BellOff className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-gray-900">Nessuna notifica</h3>
                            <p className="text-gray-500">Non hai nuove notifiche al momento</p>
                        </div>
                    ) : (
                        <>
                            {notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={cn(
                                        "w-full text-left p-4 pd-card transition-all cursor-pointer",
                                        !notification.isRead && "font-semibold"
                                    )}
                                    style={!notification.isRead ? { background: 'var(--pd-accent-soft)', borderColor: 'color-mix(in srgb, var(--pd-accent) 35%, transparent)' } : undefined}
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
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all relative z-10"
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
                                </div>
                            ))}

                            {hasMore && (
                                <button
                                    onClick={() => fetchNotifications()}
                                    disabled={loading}
                                    className="w-full py-4 text-center font-medium pd-card transition-colors"
                                    style={{ color: 'var(--pd-accent)' }}
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

            <Modal
                isOpen={!!selectedNotification}
                onClose={() => setSelectedNotification(null)}
                title={selectedNotification?.title ?? 'Notifica'}
                subtitle={
                    selectedNotification
                        ? (() => {
                              try {
                                  const date = new Date(selectedNotification.sentAt)
                                  if (isNaN(date.getTime())) return undefined
                                  return formatDistanceToNow(date, {
                                      addSuffix: true,
                                      locale: it,
                                  })
                              } catch {
                                  return undefined
                              }
                          })()
                        : undefined
                }
                maxWidth="md"
                headerIcon={
                    selectedNotification ? getNotificationIcon(selectedNotification.type) : undefined
                }
            >
                {selectedNotification && (
                    <div className="space-y-6">
                        <p
                            className="text-base leading-relaxed whitespace-pre-wrap"
                            style={{ color: 'var(--pd-text)' }}
                        >
                            {selectedNotification.body as string}
                        </p>

                        {resolveNotificationLink(selectedNotification) && (
                            <button
                                type="button"
                                onClick={() =>
                                    handleGoToLink(resolveNotificationLink(selectedNotification)!)
                                }
                                className="w-full py-3.5 pd-btn-primary transition-all flex items-center justify-center gap-2"
                            >
                                Vai alla pagina
                                <ArrowLeftRight className="h-5 w-5" />
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setSelectedNotification(null)}
                            className="w-full py-3 text-sm font-semibold rounded-xl transition-colors"
                            style={{
                                color: 'var(--pd-muted)',
                                background: 'var(--pd-surface-muted)',
                            }}
                        >
                            Chiudi
                        </button>
                    </div>
                )}
            </Modal>

            <ConfirmDialog
                isOpen={showDeleteAllConfirm}
                onClose={() => setShowDeleteAllConfirm(false)}
                onConfirm={deleteAllNotifications}
                title="Elimina tutte le notifiche"
                description="Sei sicuro di voler eliminare tutte le notifiche? Questa azione è irreversibile."
                confirmLabel="Elimina tutte"
                isDangerous
                isLoading={isDeletingAll}
            />
        </MainLayout>
    )
}
