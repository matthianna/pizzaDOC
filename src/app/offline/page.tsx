'use client'

import { useEffect, useState } from 'react'
import { WifiOff, RefreshCcw, Pizza, Database } from 'lucide-react'

export default function OfflinePage() {
    const [lastSync, setLastSync] = useState<string | null>(null)
    const [isRetrying, setIsRetrying] = useState(false)

    useEffect(() => {
        const stored = localStorage.getItem('pizzadoc_last_sync')
        if (stored) setLastSync(stored)

        const handleOnline = () => { window.location.href = '/dashboard' }
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
                setTimeout(() => setIsRetrying(false), 1000)
            }
        } catch {
            setTimeout(() => setIsRetrying(false), 1000)
        }
    }

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 sm:p-12 overflow-hidden relative">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 -mt-24 -ml-24 w-64 h-64 bg-orange-100/50 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 -mb-24 -mr-24 w-64 h-64 bg-orange-100/50 rounded-full blur-3xl"></div>

            <div className="relative z-10 max-w-sm w-full text-center space-y-8">
                {/* Visual Header */}
                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                        <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-orange-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-orange-500/40 animate-bounce-slow">
                            <Pizza className="h-12 w-12 text-white" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                            <WifiOff className="h-5 w-5 text-red-500" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Ops! Sei Offline</h1>
                        <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-2">Connessione non trovata</p>
                    </div>
                </div>

                {/* Message */}
                <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100 backdrop-blur-sm">
                    <p className="text-gray-500 text-sm font-medium leading-relaxed">
                        PizzaDOC ha bisogno di una connessione per aggiornare i turni e le ore. Controlla il tuo WiFi e riprova.
                    </p>
                </div>

                {/* Actions */}
                <div className="space-y-4">
                    <button
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white h-16 rounded-2xl font-black shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                    >
                        {isRetrying ? (
                            <RefreshCcw className="h-5 w-5 animate-spin" />
                        ) : (
                            <>
                                <RefreshCcw className="h-5 w-5" />
                                Riprova
                            </>
                        )}
                    </button>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-2xl border border-red-100">
                            <Database className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-tight">Ultimo Sync: {lastSync || 'Nessuno'}</span>
                        </div>
                    </div>
                </div>

                {/* Tips */}
                <div className="pt-6 border-t border-gray-100">
                    <div className="bg-orange-50/50 rounded-2xl p-4 inline-flex items-center gap-2 text-orange-700">
                        <span className="text-xs font-bold leading-none">💡 Prova a riavviare il WiFi del tuo dispositivo</span>
                    </div>
                </div>

                {/* Footer Brand */}
                <div className="pt-8">
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">PizzaDOC v1.1.0 Premium</p>
                </div>
            </div>
        </div>
    )
}
