'use client'

import { useState } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Bell, Send, Loader2, CheckCircle, AlertCircle, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AdminNotificationsPage() {
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [url, setUrl] = useState('')
    const [filter, setFilter] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{ success: boolean; recipients?: number; pushResult?: any } | null>(null)
    const [error, setError] = useState<string | null>(null)

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

    return (
        <MainLayout>
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-orange-100 rounded-xl">
                            <Bell className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Notifiche Broadcast</h1>
                            <p className="text-sm text-gray-500">Invia notifiche a tutti gli utenti attivi</p>
                        </div>
                    </div>

                    <div className="mb-8 p-4 bg-orange-50/50 rounded-2xl border border-orange-100 shadow-sm">
                        <h2 className="text-xs font-black text-orange-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Send className="h-3 w-3" />
                            Azioni Rapide
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                                onClick={() => {
                                    setTitle('Inserimento Disponibilità')
                                    setMessage('È ora di inserire le tue disponibilità per la prossima settimana. Grazie!')
                                    setUrl('/availability')
                                    setFilter('missing_availability')
                                }}
                                className={cn(
                                    "flex items-center gap-3 p-3 bg-white hover:bg-orange-50 border rounded-xl transition-all text-left group",
                                    filter === 'missing_availability' ? "ring-2 ring-orange-500 border-orange-500" : "border-orange-100"
                                )}
                            >
                                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-orange-600 transition-colors">
                                    <Calendar className="h-5 w-5 text-orange-600 group-hover:text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900">Richiedi Disponibilità</p>
                                    <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wider">Solo chi non ha ancora inserito</p>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    setTitle('Sollecito Ore')
                                    setMessage('Ricordati di inserire le ore lavorate per i tuoi ultimi turni!')
                                    setUrl('/hours')
                                    setFilter(null)
                                }}
                                className="flex items-center gap-3 p-3 bg-white hover:bg-orange-50 border border-orange-100 rounded-xl transition-all text-left group"
                            >
                                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-orange-600 transition-colors">
                                    <Loader2 className="h-5 w-5 text-orange-600 group-hover:text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900">Sollecito Ore</p>
                                    <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wider">Invia a tutti i dipendenti</p>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    setTitle('Piano Pubblicato')
                                    setMessage('Il nuovo piano settimanale è online. Controlla i tuoi turni!')
                                    setUrl('/weekly-plan')
                                    setFilter(null)
                                }}
                                className="flex items-center gap-3 p-3 bg-white hover:bg-orange-50 border border-orange-100 rounded-xl transition-all text-left group"
                            >
                                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-orange-600 transition-colors">
                                    <Bell className="h-5 w-5 text-orange-600 group-hover:text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900">Nuovo Piano</p>
                                    <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wider">Invia a tutta la squadra</p>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    setTitle('')
                                    setMessage('')
                                    setUrl('')
                                    setFilter(null)
                                }}
                                className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all text-left group"
                            >
                                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shrink-0 group-hover:bg-gray-900 transition-colors">
                                    <Bell className="h-5 w-5 text-gray-400 group-hover:text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-500">Messaggio Libero</p>
                                    <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">Pulisci tutti i campi</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {filter === 'missing_availability' && (
                        <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <CheckCircle className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-blue-900">Filtro Intelligente Attivo</p>
                                    <p className="text-[10px] text-blue-600">La notifica verrà inviata solo a chi non ha ancora inserito la disponibilità.</p>
                                </div>
                            </div>
                            <button onClick={() => setFilter(null)} className="text-[10px] font-black text-blue-600 uppercase hover:underline">Disattiva</button>
                        </div>
                    )}

                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-gray-100"></div>
                        </div>
                        <div className="relative flex justify-center text-xs font-black uppercase tracking-widest text-gray-400">
                            <span className="bg-white px-3">Revisione Messaggio</span>
                        </div>
                    </div>

                    <form onSubmit={handleSend} className="space-y-4">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                                Titolo
                            </label>
                            <input
                                type="text"
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                                placeholder="Es: Aggiornamento Importante"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                                Messaggio
                            </label>
                            <textarea
                                id="message"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={4}
                                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                                placeholder="Scrivi il contenuto della notifica..."
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                                URL di destinazione (opzionale)
                            </label>
                            <input
                                type="text"
                                id="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                                placeholder="Es: /schedule"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-colors"
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

                    {result && (
                        <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-100 flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                                <h3 className="font-medium text-green-900">Notifica inviata con successo!</h3>
                                <p className="text-sm text-green-700 mt-1">
                                    Destinatari nel database: {result.recipients}<br />
                                    Push inviate: {result.pushResult?.successful || 0} (Fallite: {result.pushResult?.failed || 0})
                                </p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-6 p-4 bg-red-50 rounded-xl border border-red-100 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                            <div>
                                <h3 className="font-medium text-red-900">Errore</h3>
                                <p className="text-sm text-red-700 mt-1">{error}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    )
}
