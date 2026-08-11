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
            title: 'Sollecito ore (admin)',
            subtitle: 'Avvisa gli admin',
            color: 'blue',
            action: () => {
                setTitle('Ore: richiesta agli amministratori')
                setMessage(
                    'Ci sono dipendenti con turni passati senza ore registrate o con ore rifiutate. Apri Gestione ore per completarle.'
                )
                setUrl('/admin/hours')
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
                active: 'bg-[var(--pd-accent-soft)] border-[var(--pd-accent)] ring-2 ring-[var(--pd-accent-soft)]',
                inactive: 'bg-white border-[var(--pd-border)] hover:border-[var(--pd-accent)] hover:bg-[var(--pd-accent-soft)]/50',
                icon: 'bg-[var(--pd-accent-soft)] text-[var(--pd-accent)] group-hover:bg-[var(--pd-accent)] group-hover:text-white'
            },
            blue: {
                active: 'bg-[var(--pd-accent-soft)] border-blue-500 ring-2 ring-[var(--pd-accent-soft)]',
                inactive: 'bg-white border-[var(--pd-border)] hover:border-[var(--pd-accent)] hover:bg-[var(--pd-accent-soft)]/50',
                icon: 'bg-[var(--pd-accent-soft)] text-[var(--pd-accent)] group-hover:bg-[var(--pd-accent-hover)] group-hover:text-white'
            },
            green: {
                active: 'bg-[var(--pd-success-soft)] border-green-500 ring-2 ring-[var(--pd-success-soft)]',
                inactive: 'bg-white border-[var(--pd-border)] hover:border-[var(--pd-success)] hover:bg-[var(--pd-success-soft)]/50',
                icon: 'bg-green-100 text-[var(--pd-success)] group-hover:bg-green-600 group-hover:text-white'
            },
            gray: {
                active: 'bg-[var(--pd-surface-muted)] border-[var(--pd-border)]0 ring-2 ring-[var(--pd-border)]',
                inactive: 'bg-[var(--pd-surface-muted)] border-[var(--pd-border)] hover:border-gray-400 hover:bg-[var(--pd-surface-muted)]',
                icon: 'bg-gray-200 text-[var(--pd-muted)] group-hover:bg-gray-600 group-hover:text-white'
            }
        }
        return colors[color] || colors.gray
    }

    return (
        <MainLayout>
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Header */}
                <div className="bg-[var(--pd-surface)] rounded-[var(--pd-radius-lg)] p-8 border border-[var(--pd-border)] shadow-[var(--pd-shadow)]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-[var(--pd-accent)] rounded-[var(--pd-radius)] text-[var(--pd-accent-fg)]">
                                <Send className="h-8 w-8" />
                            </div>
                            <div>
                                <h1 className="pd-display text-2xl font-semibold tracking-tight text-[var(--pd-text)]">Invia Broadcast</h1>
                                <p className="text-[var(--pd-muted)] font-medium mt-1">Notifica tutta la squadra in un click</p>
                            </div>
                        </div>
                        <a
                            href="/admin/notifications/all"
                            className="flex items-center gap-2 px-5 py-3 bg-[var(--pd-surface-muted)] hover:bg-[var(--pd-accent-soft)] rounded-[var(--pd-radius)] font-bold text-sm text-[var(--pd-text)] transition-all border border-[var(--pd-border)]"
                        >
                            <History className="h-4 w-4" />
                            Storico
                        </a>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-[var(--pd-surface)] rounded-[2rem] p-8 shadow-[var(--pd-shadow)] border border-[var(--pd-border)]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-[var(--pd-accent-soft)] rounded-xl">
                            <Zap className="h-5 w-5 text-[var(--pd-accent)]" />
                        </div>
                        <h2 className="pd-display text-lg font-semibold text-[var(--pd-text)]">Azioni Rapide</h2>
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
                                    <p className="text-sm font-bold text-[var(--pd-text)] leading-tight">{action.title}</p>
                                    <p className="text-[10px] font-medium text-[var(--pd-muted)] mt-1 uppercase tracking-wide">{action.subtitle}</p>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Filter Info */}
                {filter && (filter === 'missing_availability' || filter === 'missing_hours') && (
                    <div className="bg-[var(--pd-accent-soft)] rounded-2xl p-5 border border-[var(--pd-border)]">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[var(--pd-accent-soft)] rounded-lg">
                                    <Users className="h-4 w-4 text-[var(--pd-accent)]" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-blue-900">Filtro Intelligente Attivo</p>
                                    <p className="text-xs text-[var(--pd-accent)]">
                                        {filter === 'missing_availability'
                                            ? 'Solo chi non ha inserito la disponibilità'
                                            : 'Destinatari: amministratori. Sotto: staff con turni ancora senza ore.'}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setFilter(null)} 
                                className="text-xs font-black text-[var(--pd-accent)] uppercase hover:underline px-3 py-1 bg-[var(--pd-accent-soft)] rounded-lg"
                            >
                                Rimuovi
                            </button>
                        </div>

                        {statsLoading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-5 w-5 text-[var(--pd-accent)] animate-spin" />
                            </div>
                        ) : stats && (
                            <div className="bg-[var(--pd-surface)] rounded-xl p-4">
                                <button
                                    onClick={() => setShowLists(!showLists)}
                                    className="w-full flex items-center justify-between text-xs font-bold text-[var(--pd-muted)]"
                                >
                                    <span>
                                        {filter === 'missing_availability'
                                            ? stats.availability?.missing.length
                                            : stats.hours?.adminNotifyRecipients?.length}{' '}
                                        destinatari
                                    </span>
                                    <span className="text-[var(--pd-accent)]">{showLists ? 'Nascondi' : 'Mostra'}</span>
                                </button>

                                {showLists && (
                                    <div className="mt-4 pt-4 border-t border-[var(--pd-border)] grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[10px] font-bold text-[var(--pd-danger)] uppercase mb-2">
                                                {filter === 'missing_hours'
                                                    ? 'Staff (ore da registrare)'
                                                    : 'Mancano'}
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {(filter === 'missing_availability'
                                                    ? stats.availability?.missing
                                                    : stats.hours?.missing
                                                ).map((name: string) => (
                                                    <span
                                                        key={name}
                                                        className="px-2 py-1 bg-red-100 text-[var(--pd-danger)] rounded-lg text-xs font-medium"
                                                    >
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-[var(--pd-success)] uppercase mb-2">
                                                {filter === 'missing_hours'
                                                    ? 'Admin (ricevono la notifica)'
                                                    : 'Inserito'}
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {(filter === 'missing_availability'
                                                    ? stats.availability?.submitted
                                                    : stats.hours?.adminNotifyRecipients
                                                ).map((name: string) => (
                                                    <span
                                                        key={name}
                                                        className="px-2 py-1 bg-green-100 text-[var(--pd-success)] rounded-lg text-xs font-medium"
                                                    >
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
                <div className="bg-[var(--pd-surface)] rounded-[2rem] p-8 shadow-[var(--pd-shadow)] border border-[var(--pd-border)]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-[var(--pd-surface-muted)] rounded-xl">
                            <MessageSquare className="h-5 w-5 text-[var(--pd-muted)]" />
                        </div>
                        <h2 className="text-lg font-black text-[var(--pd-text)]">Componi Messaggio</h2>
                    </div>

                    <form onSubmit={handleSend} className="space-y-5">
                        <div>
                            <label className="block text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest mb-2 px-1">
                                Titolo
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-[var(--pd-surface-muted)] border-2 border-[var(--pd-border)] rounded-2xl px-5 py-4 text-sm font-bold text-[var(--pd-text)] focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:border-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all placeholder-[var(--pd-muted)]/50"
                                placeholder="Es: Aggiornamento Importante"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest mb-2 px-1">
                                Messaggio
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={4}
                                className="w-full bg-[var(--pd-surface-muted)] border-2 border-[var(--pd-border)] rounded-2xl px-5 py-4 text-sm font-bold text-[var(--pd-text)] focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:border-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all placeholder-[var(--pd-muted)]/50 resize-none"
                                placeholder="Scrivi il contenuto della notifica..."
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-[var(--pd-muted)] uppercase tracking-widest mb-2 px-1">
                                Link Destinazione <span className="text-[var(--pd-muted)]/50">(opzionale)</span>
                            </label>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="w-full bg-[var(--pd-surface-muted)] border-2 border-[var(--pd-border)] rounded-2xl px-5 py-4 text-sm font-bold text-[var(--pd-text)] focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:border-[var(--pd-accent)] focus:bg-[var(--pd-surface)] transition-all placeholder-[var(--pd-muted)]/50"
                                placeholder="Es: /schedule"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !title || !message}
                            className="w-full flex items-center justify-center gap-3 py-5 bg-[var(--pd-accent)] text-white text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-[var(--pd-shadow)] hover:shadow-[var(--pd-shadow)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
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
                    <div className="bg-[var(--pd-success-soft)] rounded-2xl p-6 border border-green-100 flex items-start gap-4">
                        <div className="p-3 bg-green-100 rounded-xl">
                            <CheckCircle className="h-6 w-6 text-[var(--pd-success)]" />
                        </div>
                        <div>
                            <h3 className="font-black text-green-900">Notifica inviata!</h3>
                            <p className="text-sm text-[var(--pd-success)] mt-1">
                                <strong>{result.recipients}</strong> destinatari nel database • <strong>{result.pushResult?.successful || 0}</strong> push inviate
                            </p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-[var(--pd-danger-soft)] rounded-2xl p-6 border border-[var(--pd-border)] flex items-start gap-4">
                        <div className="p-3 bg-red-100 rounded-xl">
                            <AlertCircle className="h-6 w-6 text-[var(--pd-danger)]" />
                        </div>
                        <div>
                            <h3 className="font-black text-red-900">Errore</h3>
                            <p className="text-sm text-[var(--pd-danger)] mt-1">{error}</p>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    )
}
