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
  Trash2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { SectionBlock } from '@/components/ui/section-block'
import { ListRow, EmptyState } from '@/components/ui/list-row'
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

  const { isSupported, isSubscribed, subscribe, unsubscribe, isLoading: pushLoading } =
    usePushNotifications()

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
        prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n))
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
        body: JSON.stringify({ action: 'markAllRead' }),
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
    const style = { color: 'var(--pd-accent)' } as const
    switch (type) {
      case 'SCHEDULE_PUBLISHED':
      case 'SHIFT_ASSIGNED':
      case 'SHIFT_CHANGED':
      case 'SHIFT_REMOVED':
        return <Calendar className="h-4 w-4" style={style} />
      case 'HOURS_APPROVED':
      case 'HOURS_REJECTED':
      case 'HOURS_REMINDER':
        return <Clock className="h-4 w-4" style={style} />
      case 'SUBSTITUTION_REQUEST':
      case 'SUBSTITUTION_APPLIED':
      case 'SUBSTITUTION_APPROVED':
      case 'SUBSTITUTION_REJECTED':
        return <ArrowLeftRight className="h-4 w-4" style={style} />
      case 'AVAILABILITY_REMINDER':
        return <AlertCircle className="h-4 w-4" style={{ color: 'var(--pd-warning)' }} />
      case 'ABSENCE_REQUESTED':
      case 'ABSENCE_APPROVED':
      case 'ABSENCE_REJECTED':
        return <Calendar className="h-4 w-4" style={{ color: 'var(--pd-danger)' }} />
      default:
        return <Bell className="h-4 w-4" style={{ color: 'var(--pd-muted)' }} />
    }
  }

  const formatSentAt = (sentAt: string) => {
    try {
      const date = new Date(sentAt)
      if (isNaN(date.getTime())) return ''
      return formatDistanceToNow(date, { addSuffix: true, locale: it })
    } catch {
      return ''
    }
  }

  return (
    <MainLayout contentWidth="4xl" title="Notifiche" subtitle="Avvisi e preferenze">
      <div className="pd-page pb-20">
        <PageHeader
          title="Notifiche"
          subtitle="Gestisci le tue notifiche e preferenze"
          action={
            <div className="flex items-center gap-2 flex-wrap">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDeleteAllConfirm(true)}
                  disabled={isDeletingAll}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold pd-press disabled:opacity-50"
                  style={{
                    color: 'var(--pd-danger)',
                    background: 'var(--pd-surface-muted)',
                    borderRadius: 'var(--pd-radius-pill)',
                  }}
                >
                  {isDeletingAll ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Elimina tutte
                </button>
              )}
              {notifications.some(n => !n.isRead) && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold pd-press"
                  style={{
                    color: 'var(--pd-accent)',
                    background: 'var(--pd-accent-soft)',
                    borderRadius: 'var(--pd-radius-pill)',
                  }}
                >
                  <CheckCheck className="h-4 w-4" />
                  Segna lette
                </button>
              )}
            </div>
          }
        />

        {isSupported && (
          <div
            className="flex items-center justify-between gap-4 px-4 py-3"
            style={{
              background: 'var(--pd-surface)',
              border: '1px solid var(--pd-border)',
              borderRadius: 'var(--pd-radius-lg)',
            }}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                Notifiche push
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                {isSubscribed
                  ? 'Attive su questo dispositivo'
                  : 'Attiva per non perdere aggiornamenti'}
              </p>
            </div>
            <button
              type="button"
              onClick={isSubscribed ? unsubscribe : subscribe}
              disabled={pushLoading}
              className={cn(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none',
                pushLoading && 'opacity-50 cursor-not-allowed'
              )}
              style={{
                background: isSubscribed ? 'var(--pd-accent)' : 'var(--pd-surface-muted)',
              }}
              aria-label="Attiva o disattiva notifiche push"
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full shadow transition',
                  isSubscribed ? 'translate-x-5' : 'translate-x-0'
                )}
                style={{ background: 'var(--pd-surface)' }}
              />
            </button>
          </div>
        )}

        <SectionBlock card>
          {loading && notifications.length === 0 ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--pd-accent)' }} />
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              title="Nessuna notifica"
              description="Non hai nuove notifiche al momento"
              icon={<BellOff className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
            />
          ) : (
            <>
              {notifications.map(notification => (
                <ListRow
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  highlight={!notification.isRead}
                  leading={
                    <div
                      className="w-9 h-9 flex items-center justify-center"
                      style={{
                        background: notification.isRead
                          ? 'var(--pd-surface-muted)'
                          : 'var(--pd-surface)',
                        borderRadius: 'var(--pd-radius)',
                        border: '1px solid var(--pd-border)',
                      }}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>
                  }
                  title={notification.title}
                  subtitle={notification.body}
                  meta={formatSentAt(notification.sentAt)}
                  trailing={
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        deleteNotification(e, notification.id)
                      }}
                      disabled={isDeleting === notification.id}
                      className="p-1.5 pd-press"
                      style={{ color: 'var(--pd-muted)' }}
                      aria-label="Elimina notifica"
                    >
                      {isDeleting === notification.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  }
                />
              ))}

              {hasMore && (
                <button
                  type="button"
                  onClick={() => fetchNotifications()}
                  disabled={loading}
                  className="w-full py-3.5 text-sm font-semibold pd-press"
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
        </SectionBlock>
      </div>

      <Modal
        isOpen={!!selectedNotification}
        onClose={() => setSelectedNotification(null)}
        title={selectedNotification?.title ?? 'Notifica'}
        subtitle={selectedNotification ? formatSentAt(selectedNotification.sentAt) || undefined : undefined}
        maxWidth="md"
        headerIcon={
          selectedNotification ? getNotificationIcon(selectedNotification.type) : undefined
        }
      >
        {selectedNotification && (
          <div className="space-y-5">
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: 'var(--pd-text)' }}
            >
              {selectedNotification.body}
            </p>

            {resolveNotificationLink(selectedNotification) && (
              <button
                type="button"
                onClick={() => handleGoToLink(resolveNotificationLink(selectedNotification)!)}
                className="w-full py-3 pd-btn-primary text-sm flex items-center justify-center gap-2"
              >
                Vai alla pagina
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedNotification(null)}
              className="w-full py-3 text-sm font-semibold rounded-[var(--pd-radius)]"
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
