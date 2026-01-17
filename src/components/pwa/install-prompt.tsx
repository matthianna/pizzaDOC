'use client'

import { useState, useEffect } from 'react'
import { X, Download, Share2, Home, Smartphone, Chrome, CheckCircle } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const { data: session } = useSession()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Check if user already dismissed
    const dismissed = localStorage.getItem('pwa-install-guide-dismissed')
    if (dismissed) return

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent)
    const isAndroidDevice = /android/.test(userAgent)
    
    setIsIOS(isIOSDevice)
    setIsAndroid(isAndroidDevice)

    // Android/Desktop: Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Show guide after 3 seconds (only if logged in)
    if (session) {
      const timer = setTimeout(() => {
        setShowGuide(true)
      }, 3000)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handler)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [session])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    // Show native install prompt
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowGuide(false)
      localStorage.setItem('pwa-install-guide-dismissed', 'true')
    }

    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowGuide(false)
    localStorage.setItem('pwa-install-guide-dismissed', 'true')
  }

  const nextStep = () => {
    if (isIOS && currentStep < iosSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else if (!isIOS && currentStep < androidSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  if (isInstalled || !showGuide || !session) return null

  const iosSteps = [
    {
      title: 'Installa PizzaDOC come App',
      description: 'Usa PizzaDOC come una vera app sul tuo iPhone!',
      icon: <Smartphone className="w-16 h-16 text-orange-600" />,
      action: null
    },
    {
      title: 'Tocca il pulsante Condividi',
      description: 'Clicca l\'icona di condivisione in basso (Safari)',
      icon: <Share2 className="w-16 h-16 text-blue-500" />,
      action: null,
      highlight: '📱 Cerca questo simbolo: ⬆️ (in basso al centro)'
    },
    {
      title: 'Aggiungi alla schermata Home',
      description: 'Scorri la lista e tocca "Aggiungi a Home"',
      icon: <Home className="w-16 h-16 text-green-500" />,
      action: null,
      highlight: '🏠 Cerca "Aggiungi a Home" nella lista'
    },
    {
      title: 'Conferma',
      description: 'Tocca "Aggiungi" in alto a destra',
      icon: <CheckCircle className="w-16 h-16 text-orange-600" />,
      action: null,
      highlight: '✅ L\'icona PizzaDOC apparirà sulla tua home!'
    }
  ]

  const androidSteps = [
    {
      title: 'Installa PizzaDOC come App',
      description: 'Usa PizzaDOC come una vera app sul tuo telefono!',
      icon: <Smartphone className="w-16 h-16 text-orange-600" />,
      action: deferredPrompt ? (
        <button
          onClick={handleInstallClick}
          className="w-full mt-4 px-6 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          Installa Ora
        </button>
      ) : null
    },
    {
      title: 'Tocca "Installa"',
      description: 'Chrome ti chiederà di installare l\'app',
      icon: <Chrome className="w-16 h-16 text-blue-500" />,
      action: null,
      highlight: '📱 Oppure: Menu (⋮) → "Installa app" o "Aggiungi a Home"'
    },
    {
      title: 'Fatto! 🎉',
      description: 'L\'icona PizzaDOC è sulla tua home screen',
      icon: <CheckCircle className="w-16 h-16 text-green-500" />,
      action: (
        <button
          onClick={handleDismiss}
          className="w-full mt-4 px-6 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform"
        >
          Ho capito!
        </button>
      )
    }
  ]

  const steps = isIOS ? iosSteps : androidSteps
  const step = steps[currentStep]

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] animate-fade-in" />

      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden animate-slide-up">
          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors z-10"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          {/* Content */}
          <div className="p-8 text-center">
            {/* Icon */}
            <div className="flex justify-center mb-6 animate-bounce-slow">
              {step.icon}
            </div>

            {/* Step Counter */}
            <div className="flex justify-center gap-2 mb-4">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index === currentStep
                      ? 'w-8 bg-orange-600'
                      : 'w-2 bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* Title */}
            <h2 className="text-2xl font-black text-gray-900 mb-3">
              {step.title}
            </h2>

            {/* Description */}
            <p className="text-gray-600 mb-4 text-base">
              {step.description}
            </p>

            {/* Highlight */}
            {step.highlight && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-bold text-orange-900">
                  {step.highlight}
                </p>
              </div>
            )}

            {/* Action Button */}
            {step.action}
          </div>

          {/* Navigation */}
          <div className="border-t border-gray-100 p-4 flex justify-between items-center bg-gray-50">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className={`px-4 py-2 font-bold rounded-lg transition-colors ${
                currentStep === 0
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              ← Indietro
            </button>

            <span className="text-sm font-bold text-gray-500">
              {currentStep + 1} / {steps.length}
            </span>

            {currentStep < steps.length - 1 ? (
              <button
                onClick={nextStep}
                className="px-4 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors"
              >
                Avanti →
              </button>
            ) : (
              <button
                onClick={handleDismiss}
                className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors"
              >
                Chiudi
              </button>
            )}
          </div>

          {/* Skip Button */}
          <div className="text-center pb-4">
            <button
              onClick={handleDismiss}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Non mostrare più
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </>
  )
}
