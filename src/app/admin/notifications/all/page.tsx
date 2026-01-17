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
    { id: 'ABSENCE', label: 'Assenze', icon: Calendar, types: ['GENERAL'] }, // User general for now as absence alerts use GENERAL type
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

    const fetchNotifications = async () => {
        if (!session?.user?.id) return
        setLoading(true)
        try {
            // Fetch notifications (for admin, they usually want to see their own alerts + broadcast history)
            // But here we focus on the admin's inbox which contains the critical system alerts
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

    useEffect(() => {
        fetchNotifications()
    }, [session?.user?.id])

    const filteredNotifications = notifications.filter(n => {
        // Tab filter
        const category = CATEGORIES.find(c => c.id === activeTab)
        if (category && category.types && !category.types.includes(n.type)) {
            // Hack for Absence: filter by body content if it's GENERAL
            if (activeTab === 'ABSENCE' && !n.body.toLowerCase().includes('assenza')) return false
            if (activeTab !== 'ABSENCE') return false
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
        if (body.toLowerCase().includes('assenza')) return <Calendar className="h-5 w-5 text-red-500" />

        switch (type) {
            case 'SUBSTITUTION_REQUEST':
            case 'SUBSTITUTION_APPLIED':
                return <ArrowLeftRight className="h-5 w-5 text-purple-500" />
            case 'SUBSTITUTION_APPROVED':
                return <CheckCheck className="h-5 w-5 text-green-500" />
            case 'HOURS_REJECTED':
                return <AlertCircle className="h-5 w-5 text-red-500" />
            case 'HOURS_APPROVED':
                return <CheckCheck className="h-5 w-5 text-green-500" />
            case 'SCHEDULE_PUBLISHED':
                return <Calendar className="h-5 w-5 text-blue-500" />
            default:
                return <Bell className="h-5 w-5 text-gray-500" />
        }
    }

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-orange-600 rounded-2xl shadow-lg shadow-orange-200">
                                <Bell className="h-6 w-6 text-white" />
                            </div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Board Notifiche Admin</h1>
                        </div>
                        <p className="text-gray-500 font-medium">Monitora le attività e le richieste del sistema in tempo reale.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cerca notifiche..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm"
                            />
                        </div>
                        <button
                            onClick={() => setUnreadOnly(!unreadOnly)}
                            className={cn(
                                "px-4 py-2 rounded-xl border text-sm font-bold transition-all flex items-center gap-2",
                                unreadOnly
                                    ? "bg-orange-600 border-orange-600 text-white shadow-md"
                                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
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
                                    ? "bg-white text-orange-600 shadow-md ring-1 ring-orange-100"
                                    : "text-gray-500 hover:bg-white/50 hover:text-gray-900"
                            )}
                        >
                            <cat.icon className={cn("h-4 w-4", activeTab === cat.id ? "text-orange-600" : "text-gray-400")} />
                            {cat.label}
                            {activeTab === cat.id && (
                                <span className="ml-1 px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[10px]">
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
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                                <p className="mt-4 text-sm text-gray-500 font-medium">Caricamento Board...</p>
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center px-6">
                                <SearchX className="h-12 w-12 text-gray-300 mb-4" />
                                <h3 className="text-lg font-bold text-gray-900">Nessuna notifica trovata</h3>
                                <p className="text-sm text-gray-500 mt-1">Prova a cambiare filtri o termini di ricerca.</p>
                            </div>
                        ) : (
                            filteredNotifications.map(n => (
                                <div
                                    key={n.id}
                                    onClick={() => setSelectedNotification(n)}
                                    className={cn(
                                        "group p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden",
                                        selectedNotification?.id === n.id
                                            ? "bg-white border-orange-500 shadow-lg translate-x-1"
                                            : "bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm",
                                        !n.isRead && selectedNotification?.id !== n.id && "bg-orange-50/30 border-orange-100"
                                    )}
                                >
                                    {!n.isRead && (
                                        <div className="absolute top-0 right-0 w-2 h-full bg-orange-500" />
                                    )}
                                    <div className="flex items-start gap-4">
                                        <div className={cn(
                                            "p-2.5 rounded-xl shrink-0 transition-colors",
                                            selectedNotification?.id === n.id ? "bg-orange-100" : "bg-gray-50 group-hover:bg-gray-100"
                                        )}>
                                            {getNotificationIcon(n.type, n.body)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <h4 className={cn("text-xs font-black uppercase tracking-wider", !n.isRead ? "text-orange-600" : "text-gray-400")}>
                                                    {n.type.replace('_', ' ')}
                                                </h4>
                                                <span className="text-[10px] font-bold text-gray-400">
                                                    {formatDistanceToNow(new Date(n.sentAt), { addSuffix: true, locale: it })}
                                                </span>
                                            </div>
                                            <p className={cn("text-sm truncate", !n.isRead ? "font-bold text-gray-900" : "font-medium text-gray-600")}>
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
                            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden sticky top-24 animate-in slide-in-from-right-4 duration-300">
                                <div className="p-8 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-4 bg-white rounded-2xl shadow-sm ring-1 ring-gray-200">
                                                {getNotificationIcon(selectedNotification.type, selectedNotification.body)}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-orange-600 uppercase tracking-widest mb-1">{selectedNotification.type}</p>
                                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">{selectedNotification.title}</h3>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedNotification(null)}
                                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                        >
                                            <X className="h-6 w-6 text-gray-400" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-gray-400" />
                                            <span className="text-sm font-bold text-gray-600">
                                                {format(new Date(selectedNotification.sentAt), "EEEE d MMMM, HH:mm", { locale: it })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", selectedNotification.isRead ? "bg-gray-300" : "bg-orange-500")} />
                                            <span className="text-sm font-bold text-gray-600">{selectedNotification.isRead ? 'Letta' : 'Nuova'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-10">
                                    <div className="prose prose-orange max-w-none">
                                        <p className="text-xl text-gray-700 leading-relaxed font-medium">
                                            {selectedNotification.body}
                                        </p>
                                    </div>

                                    {selectedNotification.data?.url && (
                                        <div className="mt-12 flex flex-col sm:flex-row gap-4">
                                            <a
                                                href={selectedNotification.data.url}
                                                className="flex-1 flex items-center justify-center gap-2 px-8 py-5 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-2xl font-black shadow-lg shadow-orange-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                            >
                                                Gestisci Richiesta
                                                <ChevronRight className="h-5 w-5" />
                                            </a>
                                            <button
                                                className="px-8 py-5 border border-gray-200 text-gray-700 rounded-2xl font-black hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                                                onClick={() => setSelectedNotification(null)}
                                            >
                                                Archivia
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-center">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fine Dettaglio Notifica</p>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200">
                                <div className="p-6 bg-white rounded-full shadow-sm mb-6">
                                    <Bell className="h-10 w-10 text-gray-300" />
                                </div>
                                <h3 className="text-xl font-black text-gray-400">Seleziona una notifica</h3>
                                <p className="text-gray-400 font-medium mt-1">Clicca su un elemento della lista per vedere i dettagli.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
