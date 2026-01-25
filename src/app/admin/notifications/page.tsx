'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Bell, Send, Loader2, CheckCircle, AlertCircle, Calendar, Clock, Zap, Users, MessageSquare, History } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AdminNotificationsPage() {
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [url, setUrl] = useState('')
    const [filter, setFilter] = useState<string | null>(null)
    const [stats, setStats] = useState<any>(null)
    const [showLists, setShowLists] = useState(false)
    const [loading, setLoading] = useState(false)
    const [statsLoading, setStatsLoading] = useState(false)
    const [result, setResult] = useState<{ success: boolean; recipients?: number; pushResult?: any } | null>(null)
    const [error, setError] = useState<string | null>(null)

    const fetchStats = async () => {
        setStatsLoading(true)
        try {
            const response = await fetch('/api/notifications/broadcast')
            if (response.ok) {
                const data = await response.json()
                setStats(data)
            }
        } catch (err) {
            console.error('Error fetching stats:', err)
        } finally {
            setStatsLoading(false)
        }
    }

    useEffect(() => {
        if (filter && (filter === 'missing_availability' || filter === 'missing_hours')) {
            fetchStats()
        } else {
            setStats(null)
            setShowLists(false)
        }
    }, [filter])

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title || !message) return

        setLoading(true)
        setError(null)
        setResult(null)

        try {
            const response = await fetch('/api/notifications/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, message, url, filter })
            })

            const data = await response.json()

            if (response.ok) {
                setResult(data)
                setTitle('')
                setMessage('')
                setUrl('')
                setFilter(null)
            } else {
                setError(data.error || 'Errore durante l\'invio')
            }
        } catch (err) {
            setError('Errore di connessione')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const quickActions = [
        {
            id: 'missing_availability',
            icon: Calendar,
            title: 'Richiedi Disponibilità',
            subtitle: 'Solo chi non ha ancora inserito',
            color: 'orange',
            action: () => {
                setTitle('Inserimento Disponibilità')
                setMessage('È ora di inserire le tue disponibilità per la prossima settimana. Grazie!')
                setUrl('/availability')
                setFilter('missing_availability')
            }
        },
        {
            id: 'missing_hours',
            icon: Clock,
            title: 'Sollecito Ore',
            subtitle: 'Solo chi manca',
            color: 'blue',
            action: () => {
                setTitle('Sollecito Ore')
                setMessage('Ricordati di inserire le ore lavorate per i tuoi ultimi turni!')
                setUrl('/hours')
                setFilter('missing_hours')
                fetchStats()
            }
        },
        {
            id: 'new_plan',
            icon: Bell,
            title: 'Nuovo Piano',
            subtitle: 'Invia a tutta la squadra',
            color: 'green',
            action: () => {
                setTitle('Piano Pubblicato')
                setMessage('Il nuovo piano settimanale è online. Controlla i tuoi turni!')
                setUrl('/weekly-plan')
                setFilter(null)
            }
        },
        {
            id: 'custom',
            icon: MessageSquare,
            title: 'Messaggio Libero',
            subtitle: 'Pulisci tutti i campi',
            color: 'gray',
            action: () => {
                setTitle('')
                setMessage('')
                setUrl('')
                setFilter(null)
            }
        }
    ]

    const getColorClasses = (color: string, isActive: boolean) => {
        const colors: Record<string, { active: string; inactive: string; icon: string }> = {
            orange: {
                active: 'bg-orange-50 border-orange-500 ring-2 ring-orange-200',
                inactive: 'bg-white border-gray-200 hover:border-orange-300 hover:bg-orange-50/50',
                icon: 'bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white'
            },
            blue: {
                active: 'bg-blue-50 border-blue-500 ring-2 ring-blue-200',
                inactive: 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/50',
                icon: 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
            },
            green: {
                active: 'bg-green-50 border-green-500 ring-2 ring-green-200',
                inactive: 'bg-white border-gray-200 hover:border-green-300 hover:bg-green-50/50',
                icon: 'bg-green-100 text-green-600 group-hover:bg-green-600 group-hover:text-white'
            },
            gray: {
                active: 'bg-gray-100 border-gray-500 ring-2 ring-gray-200',
                inactive: 'bg-gray-50 border-gray-200 hover:border-gray-400 hover:bg-gray-100',
                icon: 'bg-gray-200 text-gray-600 group-hover:bg-gray-600 group-hover:text-white'
            }
        }
        return colors[color] || colors.gray
    }

    return (
        <MainLayout>
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Header */}
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-[2rem] p-8 text-white shadow-xl shadow-orange-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-white/20 backdrop-blur rounded-2xl">
                                <Send className="h-8 w-8" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight">Invia Broadcast</h1>
                                <p className="text-orange-100 font-medium mt-1">Notifica tutta la squadra in un click</p>
                            </div>
                        </div>
                        <a
                            href="/admin/notifications/all"
                            className="flex items-center gap-2 px-5 py-3 bg-white/20 backdrop-blur hover:bg-white/30 rounded-xl font-bold text-sm transition-all"
                        >
                            <History className="h-4 w-4" />
                            Storico
                        </a>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-[2rem] p-8 shadow-soft border border-gray-100">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-orange-100 rounded-xl">
                            <Zap className="h-5 w-5 text-orange-600" />
                        </div>
                        <h2 className="text-lg font-black text-gray-900">Azioni Rapide</h2>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {quickActions.map((action) => {
                            const isActive = filter === action.id || (action.id === 'new_plan' && filter === null && title === 'Piano Pubblicato')
                            const colorClasses = getColorClasses(action.color, isActive)
                            
                            return (
                                <button
                                    key={action.id}
                                    onClick={action.action}
                                    className={cn(
                                        "group flex flex-col items-center text-center p-5 rounded-2xl border-2 transition-all duration-200",
                                        isActive ? colorClasses.active : colorClasses.inactive
                                    )}
                                >
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all",
                                        colorClasses.icon
                                    )}>
                                        <action.icon className="h-6 w-6" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-900 leading-tight">{action.title}</p>
                                    <p className="text-[10px] font-medium text-gray-500 mt-1 uppercase tracking-wide">{action.subtitle}</p>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Filter Info */}
                {filter && (filter === 'missing_availability' || filter === 'missing_hours') && (
                    <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Users className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-blue-900">Filtro Intelligente Attivo</p>
                                    <p className="text-xs text-blue-600">
                                        {filter === 'missing_availability'
                                            ? "Solo chi non ha inserito la disponibilità"
                                            : "Solo chi non ha inserito le ore"
                                        }
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setFilter(null)} 
                                className="text-xs font-black text-blue-600 uppercase hover:underline px-3 py-1 bg-blue-100 rounded-lg"
                            >
                                Rimuovi
                            </button>
                        </div>

                        {statsLoading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                            </div>
                        ) : stats && (
                            <div className="bg-white rounded-xl p-4">
                                <button
                                    onClick={() => setShowLists(!showLists)}
                                    className="w-full flex items-center justify-between text-xs font-bold text-gray-600"
                                >
                                    <span>
                                        {filter === 'missing_availability' ? stats.availability?.missing.length : stats.hours?.missing.length} destinatari
                                    </span>
                                    <span className="text-blue-600">{showLists ? 'Nascondi' : 'Mostra'}</span>
                                </button>

                                {showLists && (
                                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[10px] font-bold text-red-600 uppercase mb-2">Mancano</p>
                                            <div className="flex flex-wrap gap-1">
                                                {(filter === 'missing_availability' ? stats.availability?.missing : stats.hours?.missing).map((name: string) => (
                                                    <span key={name} className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-green-600 uppercase mb-2">Inserito</p>
                                            <div className="flex flex-wrap gap-1">
                                                {(filter === 'missing_availability' ? stats.availability?.submitted : stats.hours?.submitted).map((name: string) => (
                                                    <span key={name} className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Message Form */}
                <div className="bg-white rounded-[2rem] p-8 shadow-soft border border-gray-100">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gray-100 rounded-xl">
                            <MessageSquare className="h-5 w-5 text-gray-600" />
                        </div>
                        <h2 className="text-lg font-black text-gray-900">Componi Messaggio</h2>
                    </div>

                    <form onSubmit={handleSend} className="space-y-5">
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">
                                Titolo
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white transition-all placeholder-gray-400"
                                placeholder="Es: Aggiornamento Importante"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">
                                Messaggio
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={4}
                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white transition-all placeholder-gray-400 resize-none"
                                placeholder="Scrivi il contenuto della notifica..."
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">
                                Link Destinazione <span className="text-gray-300">(opzionale)</span>
                            </label>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white transition-all placeholder-gray-400"
                                placeholder="Es: /schedule"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !title || !message}
                            className="w-full flex items-center justify-center gap-3 py-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-orange-200 hover:shadow-orange-300 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <Send className="h-5 w-5" />
                                    {filter ? 'Invia ai Destinatari Filtrati' : 'Invia a Tutta la Squadra'}
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Success/Error Messages */}
                {result && (
                    <div className="bg-green-50 rounded-2xl p-6 border border-green-100 flex items-start gap-4">
                        <div className="p-3 bg-green-100 rounded-xl">
                            <CheckCircle className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-black text-green-900">Notifica inviata!</h3>
                            <p className="text-sm text-green-700 mt-1">
                                <strong>{result.recipients}</strong> destinatari nel database • <strong>{result.pushResult?.successful || 0}</strong> push inviate
                            </p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 rounded-2xl p-6 border border-red-100 flex items-start gap-4">
                        <div className="p-3 bg-red-100 rounded-xl">
                            <AlertCircle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <h3 className="font-black text-red-900">Errore</h3>
                            <p className="text-sm text-red-700 mt-1">{error}</p>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    )
}
