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
    X,
    Filter,
    Search,
    ChevronRight,
    SearchX
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { it } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { MainLayout } from '@/components/layout/main-layout'

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
    { id: 'SUBSTITUTION', label: 'Sostituzioni', icon: ArrowLeftRight, types: ['SUBSTITUTION_REQUEST', 'SUBSTITUTION_APPLIED', 'SUBSTITUTION_APPROVED', 'SUBSTITUTION_REJECTED'] },
    { id: 'ABSENCE', label: 'Assenze', icon: Calendar, types: ['ABSENCE_REQUESTED', 'ABSENCE_APPROVED', 'ABSENCE_REJECTED'] },
    { id: 'HOURS', label: 'Ore', icon: Clock, types: ['HOURS_APPROVED', 'HOURS_REJECTED', 'HOURS_REMINDER'] },
    { id: 'SCHEDULE', label: 'Piano', icon: Calendar, types: ['SCHEDULE_PUBLISHED', 'SHIFT_ASSIGNED', 'SHIFT_CHANGED', 'SHIFT_REMOVED'] },
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
                    prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
                )
            }
        } catch (error) {
            console.error('Error marking notification as read:', error)
        }
    }

    const deleteNotification = async (notificationId: string) => {
        if (!confirm('Sei sicuro di voler eliminare questa notifica?')) return
        
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
        // Tab filter
        const category = CATEGORIES.find(c => c.id === activeTab)
        if (category && category.types && !category.types.includes(n.type)) {
            return false
        }

        // Unread filter
        if (unreadOnly && n.isRead) return false

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            return n.title.toLowerCase().includes(query) ||
                n.body.toLowerCase().includes(query) ||
                (n.user?.username.toLowerCase().includes(query))
        }

        return true
    })

    const getNotificationIcon = (type: string, body: string) => {
        switch (type) {
            case 'ABSENCE_REQUESTED':
            case 'ABSENCE_APPROVED':
            case 'ABSENCE_REJECTED':
                return <Calendar className="h-5 w-5 text-[var(--pd-danger)]" />
            case 'SUBSTITUTION_REQUEST':
            case 'SUBSTITUTION_APPLIED':
                return <ArrowLeftRight className="h-5 w-5 text-[var(--pd-accent)]" />
            case 'SUBSTITUTION_APPROVED':
                return <CheckCheck className="h-5 w-5 text-[var(--pd-success)]" />
            case 'HOURS_REJECTED':
                return <AlertCircle className="h-5 w-5 text-[var(--pd-danger)]" />
            case 'HOURS_APPROVED':
                return <CheckCheck className="h-5 w-5 text-[var(--pd-success)]" />
            case 'SCHEDULE_PUBLISHED':
                return <Calendar className="h-5 w-5 text-[var(--pd-accent)]" />
            default:
                return <Bell className="h-5 w-5 text-[var(--pd-muted)]" />
        }
    }

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-[var(--pd-accent)] rounded-2xl shadow-lg shadow-[var(--pd-shadow)]">
                                <Bell className="h-6 w-6 text-white" />
                            </div>
                            <h1 className="pd-display text-3xl font-semibold text-[var(--pd-text)] tracking-tight">Board Notifiche Admin</h1>
                        </div>
                        <p className="text-[var(--pd-muted)] font-medium">Monitora le attività e le richieste del sistema in tempo reale.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--pd-muted)]" />
                            <input
                                type="text"
                                placeholder="Cerca notifiche..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-[var(--pd-border)] rounded-xl focus:ring-2 focus:ring-[var(--pd-accent)] focus:border-[var(--pd-accent)] transition-all shadow-sm"
                            />
                        </div>
                        <button
                            onClick={() => setUnreadOnly(!unreadOnly)}
                            className={cn(
                                "px-4 py-2 rounded-xl border text-sm font-bold transition-all flex items-center gap-2",
                                unreadOnly
                                    ? "bg-[var(--pd-accent)] border-[var(--pd-accent)] text-white shadow-md"
                                    : "bg-[var(--pd-surface)] border-[var(--pd-border)] text-[var(--pd-text)] hover:bg-[var(--pd-surface-muted)]"
                            )}
                        >
                            <Filter className="h-4 w-4" />
                            {unreadOnly ? 'Solo non lette' : 'Tutte'}
                        </button>
                    </div>
                </div>

                {/* Categories Tab */}
                <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            className={cn(
                                "flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black whitespace-nowrap transition-all",
                                activeTab === cat.id
                                    ? "bg-[var(--pd-surface)] text-[var(--pd-accent)] shadow-md ring-1 ring-orange-100"
                                    : "text-[var(--pd-muted)] hover:bg-white/50 hover:text-[var(--pd-text)]"
                            )}
                        >
                            <cat.icon className={cn("h-4 w-4", activeTab === cat.id ? "text-[var(--pd-accent)]" : "text-[var(--pd-muted)]")} />
                            {cat.label}
                            {activeTab === cat.id && (
                                <span className="ml-1 px-2 py-0.5 bg-[var(--pd-accent-soft)] text-[var(--pd-accent)] rounded-full text-[10px]">
                                    {filteredNotifications.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* List Pane */}
                    <div className="lg:col-span-1 space-y-3">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-[var(--pd-surface)] rounded-3xl border border-dashed border-[var(--pd-border)]">
                                <Loader2 className="h-8 w-8 animate-spin text-[var(--pd-accent-fg)]/800" />
                                <p className="mt-4 text-sm text-[var(--pd-muted)] font-medium">Caricamento Board...</p>
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-[var(--pd-surface)] rounded-3xl border border-dashed border-[var(--pd-border)] text-center px-6">
                                <SearchX className="h-12 w-12 text-[var(--pd-muted)]/50 mb-4" />
                                <h3 className="text-lg font-bold text-[var(--pd-text)]">Nessuna notifica trovata</h3>
                                <p className="text-sm text-[var(--pd-muted)] mt-1">Prova a cambiare filtri o termini di ricerca.</p>
                            </div>
                        ) : (
                            filteredNotifications.map(n => (
                                <div
                                    key={n.id}
                                    onClick={() => handleSelectNotification(n)}
                                    className={cn(
                                        "group p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden",
                                        selectedNotification?.id === n.id
                                            ? "bg-[var(--pd-surface)] border-[var(--pd-accent)] shadow-lg translate-x-1"
                                            : "bg-[var(--pd-surface)] border-[var(--pd-border)] hover:border-[var(--pd-border-strong)] hover:shadow-sm",
                                        !n.isRead && selectedNotification?.id !== n.id && "bg-[var(--pd-accent-soft)]/30 border-[var(--pd-border)]"
                                    )}
                                >
                                    {!n.isRead && (
                                        <div className="absolute top-0 right-0 w-2 h-full bg-[var(--pd-accent)]" />
                                    )}
                                    <div className="flex items-start gap-4">
                                        <div className={cn(
                                            "p-2.5 rounded-xl shrink-0 transition-colors",
                                            selectedNotification?.id === n.id ? "bg-[var(--pd-accent-soft)]" : "bg-[var(--pd-surface-muted)] group-hover:bg-[var(--pd-surface-muted)]"
                                        )}>
                                            {getNotificationIcon(n.type, n.body)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <h4 className={cn("text-xs font-black uppercase tracking-wider", !n.isRead ? "text-[var(--pd-accent)]" : "text-[var(--pd-muted)]")}>
                                                    {n.type.replace('_', ' ')}
                                                </h4>
                                                <span className="text-[10px] font-bold text-[var(--pd-muted)]">
                                                    {formatDistanceToNow(new Date(n.sentAt), { addSuffix: true, locale: it })}
                                                </span>
                                            </div>
                                            <p className={cn("text-sm truncate", !n.isRead ? "font-bold text-[var(--pd-text)]" : "font-medium text-[var(--pd-muted)]")}>
                                                {n.title}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Detail Pane */}
                    <div className="lg:col-span-2">
                        {selectedNotification ? (
                            <div className="bg-[var(--pd-surface)] rounded-3xl shadow-xl border border-[var(--pd-border)] overflow-hidden sticky top-24 animate-in slide-in-from-right-4 duration-300">
                                <div className="p-8 border-b border-[var(--pd-border)] bg-[var(--pd-surface-muted)]">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-4 bg-[var(--pd-surface)] rounded-2xl shadow-sm ring-1 ring-[var(--pd-border)]">
                                                {getNotificationIcon(selectedNotification.type, selectedNotification.body)}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-[var(--pd-accent)] uppercase tracking-widest mb-1">{selectedNotification.type}</p>
                                                <h3 className="text-2xl font-black text-[var(--pd-text)] tracking-tight">{selectedNotification.title}</h3>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedNotification(null)}
                                            className="p-2 hover:bg-[var(--pd-surface-muted)] rounded-full transition-colors"
                                        >
                                            <X className="h-6 w-6 text-[var(--pd-muted)]" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-[var(--pd-muted)]" />
                                            <span className="text-sm font-bold text-[var(--pd-muted)]">
                                                {format(new Date(selectedNotification.sentAt), "EEEE d MMMM, HH:mm", { locale: it })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", selectedNotification.isRead ? "bg-gray-300" : "bg-[var(--pd-accent)]")} />
                                            <span className="text-sm font-bold text-[var(--pd-muted)]">{selectedNotification.isRead ? 'Letta' : 'Nuova'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-10">
                                    <div className="prose prose-orange max-w-none">
                                        <p className="text-xl text-[var(--pd-text)] leading-relaxed font-medium">
                                            {selectedNotification.body}
                                        </p>
                                    </div>

                                    {selectedNotification.data?.url && (
                                        <div className="mt-12 flex flex-col sm:flex-row gap-4">
                                            <a
                                                href={selectedNotification.data.url}
                                                className="flex-1 flex items-center justify-center gap-2 px-8 py-5 bg-[var(--pd-accent)] text-white rounded-2xl font-black shadow-lg shadow-[var(--pd-shadow)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                                            >
                                                Gestisci Richiesta
                                                <ChevronRight className="h-5 w-5" />
                                            </a>
                                            <button
                                                className="px-8 py-5 border border-[var(--pd-border)] text-[var(--pd-danger)] rounded-2xl font-black hover:bg-[var(--pd-danger-soft)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                onClick={() => deleteNotification(selectedNotification.id)}
                                                disabled={isDeleting === selectedNotification.id}
                                            >
                                                {isDeleting === selectedNotification.id ? (
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                ) : (
                                                    <>
                                                        Elimina
                                                        <Trash2 className="h-5 w-5" />
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 bg-[var(--pd-surface-muted)]/80 border-t border-[var(--pd-border)] flex items-center justify-center">
                                    <p className="text-xs font-bold text-[var(--pd-muted)] uppercase tracking-widest">Fine Dettaglio Notifica</p>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-[var(--pd-surface-muted)]/80 rounded-3xl border-2 border-dashed border-[var(--pd-border)]">
                                <div className="p-6 bg-[var(--pd-surface)] rounded-full shadow-sm mb-6">
                                    <Bell className="h-10 w-10 text-[var(--pd-muted)]/50" />
                                </div>
                                <h3 className="text-xl font-black text-[var(--pd-muted)]">Seleziona una notifica</h3>
                                <p className="text-[var(--pd-muted)] font-medium mt-1">Clicca su un elemento della lista per vedere i dettagli.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
