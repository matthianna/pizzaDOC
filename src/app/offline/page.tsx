'use client'

import { useEffect, useState } from 'react'
import { WifiOff, RefreshCcw, Pizza, Database } from 'lucide-react'

export default function OfflinePage() {
    const [lastSync, setLastSync] = useState<string | null>(null)
    const [isRetrying, setIsRetrying] = useState(false)

    useEffect(() => {
        // Check localStorage for last sync time
        const stored = localStorage.getItem('pizzadoc_last_sync')
        if (stored) {
            setLastSync(stored)
        }

        // Listen for online event
        const handleOnline = () => {
            window.location.href = '/dashboard'
        }
        window.addEventListener('online', handleOnline)
        return () => window.removeEventListener('online', handleOnline)
    }, [])

    const handleRetry = async () => {
        setIsRetrying(true)
        try {
            const response = await fetch('/api/health', { cache: 'no-store' })
            if (response.ok) {
                window.location.href = '/dashboard'
            } else {
                setIsRetrying(false)
            }
        } catch {
            setIsRetrying(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Logo and Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg mb-4">
                        <Pizza className="h-12 w-12 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">PizzaDOC</h1>
                </div>

                {/* Offline Card */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-gray-100 to-gray-50 px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                <WifiOff className="h-5 w-5 text-gray-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Sei offline
                                </h2>
                                <p className="text-sm text-gray-600">
                                    Nessuna connessione internet
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        <p className="text-gray-600 mb-6">
                            Non riusciamo a connetterci ai server di PizzaDOC.
                            Controlla la tua connessione internet e riprova.
                        </p>

                        {/* Retry Button */}
                        <button
                            onClick={handleRetry}
                            disabled={isRetrying}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold py-3 px-6 rounded-xl shadow-md hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-60"
                        >
                            <RefreshCcw className={`h-5 w-5 ${isRetrying ? 'animate-spin' : ''}`} />
                            {isRetrying ? 'Connessione in corso...' : 'Riprova'}
                        </button>

                        {/* Last Sync Info */}
                        {lastSync && (
                            <div className="mt-6 flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">
                                <Database className="h-4 w-4" />
                                <span>Ultimo aggiornamento: {lastSync}</span>
                            </div>
                        )}
                    </div>

                    {/* Footer Tips */}
                    <div className="bg-orange-50 px-6 py-4 border-t border-orange-100">
                        <h3 className="text-sm font-semibold text-orange-800 mb-2">
                            💡 Suggerimenti:
                        </h3>
                        <ul className="text-sm text-orange-700 space-y-1">
                            <li>• Verifica che il WiFi o i dati mobili siano attivi</li>
                            <li>• Prova a disattivare e riattivare i dati</li>
                            <li>• Controlla se altri siti funzionano</li>
                        </ul>
                    </div>
                </div>

                {/* Version */}
                <p className="text-center text-xs text-gray-400 mt-6">
                    PizzaDOC v1.0.0
                </p>
            </div>
        </div>
    )
}
