'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  Bell,
  CheckCheck,
  Calendar,
  Clock,
  ArrowLeftRight,
  AlertCircle,
  Loader2,
  Trash2,
  X,
  Filter,
  Search,
  ChevronRight,
  SearchX,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { it } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { SectionBlock } from '@/components/ui/section-block'
import { ListRow, EmptyState } from '@/components/ui/list-row'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  data?: any
  isRead: boolean
  sentAt: string
  user?: {
    username: string
  }
}

const CATEGORIES = [
  { id: 'ALL', label: 'Tutte', icon: Bell },
  {
    id: 'SUBSTITUTION',
    label: 'Sostituzioni',
    icon: ArrowLeftRight,
    types: ['SUBSTITUTION_REQUEST', 'SUBSTITUTION_APPLIED', 'SUBSTITUTION_APPROVED', 'SUBSTITUTION_REJECTED'],
  },
  {
    id: 'ABSENCE',
    label: 'Assenze',
    icon: Calendar,
    types: ['ABSENCE_REQUESTED', 'ABSENCE_APPROVED', 'ABSENCE_REJECTED'],
  },
  {
    id: 'HOURS',
    label: 'Ore',
    icon: Clock,
    types: ['HOURS_APPROVED', 'HOURS_REJECTED', 'HOURS_REMINDER'],
  },
  {
    id: 'SCHEDULE',
    label: 'Piano',
    icon: Calendar,
    types: ['SCHEDULE_PUBLISHED', 'SHIFT_ASSIGNED', 'SHIFT_CHANGED', 'SHIFT_REMOVED'],
  },
]

export default function AdminNotificationBoard() {
  const { data: session } = useSession()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Notification | null>(null)

  const fetchNotifications = async () => {
    if (!session?.user?.id) return
    setLoading(true)
    try {
      const response = await fetch('/api/notifications?limit=100')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' })
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n))
        )
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const deleteNotification = async () => {
    if (!deleteTarget) return
    const notificationId = deleteTarget.id
    setIsDeleting(notificationId)
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE' })
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        if (selectedNotification?.id === notificationId) {
          setSelectedNotification(null)
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    } finally {
      setIsDeleting(null)
      setDeleteTarget(null)
    }
  }

  const handleSelectNotification = (n: Notification) => {
    setSelectedNotification(n)
    if (!n.isRead) {
      markAsRead(n.id)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [session?.user?.id])

  const filteredNotifications = notifications.filter(n => {
    const category = CATEGORIES.find(c => c.id === activeTab)
    if (category && category.types && !category.types.includes(n.type)) {
      return false
    }
    if (unreadOnly && n.isRead) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        n.title.toLowerCase().includes(query) ||
        n.body.toLowerCase().includes(query) ||
        (n.user?.username.toLowerCase().includes(query) ?? false)
      )
    }
    return true
  })

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ABSENCE_REQUESTED':
      case 'ABSENCE_APPROVED':
      case 'ABSENCE_REJECTED':
        return <Calendar className="h-4 w-4" style={{ color: 'var(--pd-danger)' }} />
      case 'SUBSTITUTION_REQUEST':
      case 'SUBSTITUTION_APPLIED':
        return <ArrowLeftRight className="h-4 w-4" style={{ color: 'var(--pd-accent)' }} />
      case 'SUBSTITUTION_APPROVED':
        return <CheckCheck className="h-4 w-4" style={{ color: 'var(--pd-success)' }} />
      case 'HOURS_REJECTED':
        return <AlertCircle className="h-4 w-4" style={{ color: 'var(--pd-danger)' }} />
      case 'HOURS_APPROVED':
        return <CheckCheck className="h-4 w-4" style={{ color: 'var(--pd-success)' }} />
      case 'SCHEDULE_PUBLISHED':
        return <Calendar className="h-4 w-4" style={{ color: 'var(--pd-accent)' }} />
      default:
        return <Bell className="h-4 w-4" style={{ color: 'var(--pd-muted)' }} />
    }
  }

  return (
    <MainLayout adminOnly contentWidth="6xl">
      <div className="pd-page">
        <PageHeader
          dense
          title="Board notifiche"
          subtitle="Monitora attività e richieste del sistema"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: 'var(--pd-muted)' }}
                />
                <input
                  type="text"
                  placeholder="Cerca…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-44 sm:w-56 pl-9 pr-3 py-2 text-sm border focus:outline-none focus:ring-2"
                  style={{
                    borderColor: 'var(--pd-border)',
                    borderRadius: 'var(--pd-radius)',
                    background: 'var(--pd-surface)',
                    color: 'var(--pd-text)',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => setUnreadOnly(!unreadOnly)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border"
                style={{
                  borderRadius: 'var(--pd-radius)',
                  borderColor: unreadOnly ? 'var(--pd-accent)' : 'var(--pd-border)',
                  background: unreadOnly ? 'var(--pd-accent)' : 'var(--pd-surface)',
                  color: unreadOnly ? 'var(--pd-accent-fg)' : 'var(--pd-text)',
                }}
              >
                <Filter className="h-4 w-4" />
                {unreadOnly ? 'Solo non lette' : 'Tutte'}
              </button>
            </div>
          }
        />

        <div
          className="flex items-center gap-1 overflow-x-auto p-1"
          style={{
            background: 'var(--pd-surface-muted)',
            borderRadius: 'var(--pd-radius-lg)',
            border: '1px solid var(--pd-border)',
          }}
        >
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveTab(cat.id)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                activeTab === cat.id && 'shadow-sm'
              )}
              style={{
                borderRadius: 'var(--pd-radius)',
                background: activeTab === cat.id ? 'var(--pd-surface)' : 'transparent',
                color: activeTab === cat.id ? 'var(--pd-text)' : 'var(--pd-muted)',
              }}
            >
              <cat.icon className="h-4 w-4" />
              {cat.label}
              {activeTab === cat.id && (
                <span
                  className="ml-0.5 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                  style={{
                    background: 'var(--pd-accent-soft)',
                    color: 'var(--pd-accent)',
                    borderRadius: '999px',
                  }}
                >
                  {filteredNotifications.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionBlock title="Elenco" className="lg:col-span-1" card>
            {loading ? (
              <EmptyState
                title="Caricamento…"
                icon={<Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--pd-accent)' }} />}
              />
            ) : filteredNotifications.length === 0 ? (
              <EmptyState
                title="Nessuna notifica"
                description="Prova a cambiare filtri o termini di ricerca."
                icon={<SearchX className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
              />
            ) : (
              filteredNotifications.map(n => (
                <ListRow
                  key={n.id}
                  as="button"
                  onClick={() => handleSelectNotification(n)}
                  highlight={selectedNotification?.id === n.id || !n.isRead}
                  title={n.title}
                  subtitle={n.type.replace(/_/g, ' ')}
                  meta={formatDistanceToNow(new Date(n.sentAt), { addSuffix: true, locale: it })}
                  leading={getNotificationIcon(n.type)}
                />
              ))
            )}
          </SectionBlock>

          <SectionBlock title="Dettaglio" className="lg:col-span-2" card>
            {selectedNotification ? (
              <div>
                <div
                  className="p-5 flex items-start justify-between gap-4"
                  style={{ borderBottom: '1px solid var(--pd-border)' }}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="p-2.5 shrink-0"
                      style={{
                        background: 'var(--pd-surface-muted)',
                        borderRadius: 'var(--pd-radius)',
                      }}
                    >
                      {getNotificationIcon(selectedNotification.type)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium" style={{ color: 'var(--pd-muted)' }}>
                        {selectedNotification.type.replace(/_/g, ' ')}
                      </p>
                      <h3
                        className="text-lg font-semibold tracking-tight mt-0.5"
                        style={{ color: 'var(--pd-text)' }}
                      >
                        {selectedNotification.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs" style={{ color: 'var(--pd-muted)' }}>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(selectedNotification.sentAt), "EEEE d MMMM, HH:mm", {
                            locale: it,
                          })}
                        </span>
                        <span>
                          {selectedNotification.isRead ? 'Letta' : 'Nuova'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedNotification(null)}
                    className="p-2 shrink-0"
                    style={{ color: 'var(--pd-muted)' }}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-5 sm:p-6">
                  <p className="text-base leading-relaxed" style={{ color: 'var(--pd-text)' }}>
                    {selectedNotification.body}
                  </p>

                  <div className="mt-8 flex flex-col sm:flex-row gap-2">
                    {selectedNotification.data?.url && (
                      <a
                        href={selectedNotification.data.url}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm pd-btn-primary"
                      >
                        Gestisci richiesta
                        <ChevronRight className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      className="px-4 py-3 text-sm font-medium border inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{
                        borderColor: 'var(--pd-border)',
                        borderRadius: 'var(--pd-radius)',
                        color: 'var(--pd-danger)',
                        background: 'var(--pd-surface)',
                      }}
                      onClick={() => setDeleteTarget(selectedNotification)}
                      disabled={isDeleting === selectedNotification.id}
                    >
                      {isDeleting === selectedNotification.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Elimina
                          <Trash2 className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Seleziona una notifica"
                description="Clicca su un elemento dell'elenco per vedere i dettagli."
                icon={<Bell className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
              />
            )}
          </SectionBlock>
        </div>
      </div>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteNotification}
        title="Elimina notifica"
        description="Sei sicuro di voler eliminare questa notifica? L'azione non può essere annullata."
        confirmPhrase="ELIMINA"
        confirmButtonText="Elimina"
        isDangerous={true}
        metadata={
          deleteTarget && (
            <div className="text-sm space-y-1">
              <p>
                <strong>Titolo:</strong> {deleteTarget.title}
              </p>
              <p>
                <strong>Tipo:</strong> {deleteTarget.type}
              </p>
            </div>
          )
        }
      />
    </MainLayout>
  )
}
