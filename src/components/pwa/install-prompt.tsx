'use client'

import { useState, useEffect } from 'react'
import { X, Download, Share, Plus } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [showPrompt, setShowPrompt] = useState(false)
    const [isIOS, setIsIOS] = useState(false)
    const [isStandalone, setIsStandalone] = useState(false)

    useEffect(() => {
        // Check if already installed
        const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
        setIsStandalone(isInStandaloneMode)

        if (isInStandaloneMode) return

        // Detect iOS
        const isIOSDevice = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream
        setIsIOS(isIOSDevice)

        // Check if user dismissed in last 7 days
        const lastDismissed = localStorage.getItem('pwa_install_dismissed')
        if (lastDismissed) {
            const dismissedDate = new Date(lastDismissed)
            const now = new Date()
            const daysDiff = Math.floor((now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24))
            if (daysDiff < 7) return
        }

        // Show prompt after a delay for better UX
        const timer = setTimeout(() => {
            if (isIOSDevice) {
                setShowPrompt(true)
            }
        }, 3000)

        // Listen for beforeinstallprompt (Chrome, Edge, etc.)
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
            // Show prompt after user has interacted with the app
            setTimeout(() => setShowPrompt(true), 3000)
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

        return () => {
            clearTimeout(timer)
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        }
    }, [])

    const handleInstall = async () => {
        if (!deferredPrompt) return

        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === 'accepted') {
            setDeferredPrompt(null)
            setShowPrompt(false)
        }
    }

    const handleDismiss = () => {
        setShowPrompt(false)
        localStorage.setItem('pwa_install_dismissed', new Date().toISOString())
    }

    // Don't show if already installed
    if (isStandalone || !showPrompt) return null

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up lg:left-auto lg:right-6 lg:bottom-6 lg:w-96">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Download className="h-5 w-5 text-white" />
                        <span className="text-white font-semibold">Installa PizzaDOC</span>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    {isIOS ? (
                        // iOS instructions
                        <div className="space-y-3">
                            <p className="text-gray-700 text-sm">
                                Per installare PizzaDOC sul tuo iPhone:
                            </p>
                            <ol className="text-sm text-gray-600 space-y-2">
                                <li className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Share className="h-4 w-4 text-gray-600" />
                                    </div>
                                    Tocca il pulsante Condividi
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Plus className="h-4 w-4 text-gray-600" />
                                    </div>
                                    Seleziona "Aggiungi a Home"
                                </li>
                            </ol>
                            <button
                                onClick={handleDismiss}
                                className="w-full mt-2 py-2 text-sm text-gray-600 hover:text-gray-800"
                            >
                                Ho capito
                            </button>
                        </div>
                    ) : (
                        // Chrome/Android install
                        <div className="space-y-3">
                            <p className="text-gray-700 text-sm">
                                Installa PizzaDOC per accedere rapidamente ai tuoi turni e alla disponibilità.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleInstall}
                                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download className="h-4 w-4" />
                                    Installa
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="px-4 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Non ora
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// Hook to check if PWA is installable
export function usePWAInstall() {
    const [canInstall, setCanInstall] = useState(false)
    const [isInstalled, setIsInstalled] = useState(false)

    useEffect(() => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
        setIsInstalled(isStandalone)

        const handler = () => setCanInstall(true)
        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    return { canInstall, isInstalled }
}
