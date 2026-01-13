'use client'

import { useState } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Bell, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function AdminNotificationsPage() {
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [url, setUrl] = useState('')
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
                body: JSON.stringify({ title, message, url })
            })

            const data = await response.json()

            if (response.ok) {
                setResult(data)
                setTitle('')
                setMessage('')
                setUrl('')
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
                            <h1 className="text-xl font-bold text-gray-900">Invia Notifica Broadcast</h1>
                            <p className="text-sm text-gray-500">Invia una notifica a tutti gli utenti attivi</p>
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
                                    Invia a Tutti
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
