'use client'

import { useState, useEffect, useLayoutEffect, useCallback, type ReactNode } from 'react'
import { Download, Share2, Home, Smartphone, Chrome, CheckCircle } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  return false
}

/** Production: require install. Set NEXT_PUBLIC_SKIP_PWA_INSTALL_GATE=true to disable (emergencies). */
function isInstallGateSkipped(): boolean {
  if (process.env.NEXT_PUBLIC_SKIP_PWA_INSTALL_GATE === 'true') return true
  // In dev the site is almost never standalone; skip unless you opt in to test the gate.
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FORCE_PWA_IN_DEV !== 'true') {
    return true
  }
  return false
}

export function PWAInstallPrompt() {
  const { data: session, status } = useSession()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null)

  const refreshInstalled = useCallback(() => {
    setIsInstalled(isPWAInstalled())
  }, [])

  useLayoutEffect(() => {
    refreshInstalled()
  }, [refreshInstalled])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onInstalled = () => setIsInstalled(true)
    window.addEventListener('appinstalled', onInstalled)

    const mqStandalone = window.matchMedia('(display-mode: standalone)')
    const mqFullscreen = window.matchMedia('(display-mode: fullscreen)')
    const onDisplayModeChange = () => refreshInstalled()
    mqStandalone.addEventListener('change', onDisplayModeChange)
    mqFullscreen.addEventListener('change', onDisplayModeChange)

    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshInstalled()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('appinstalled', onInstalled)
      mqStandalone.removeEventListener('change', onDisplayModeChange)
      mqFullscreen.removeEventListener('change', onDisplayModeChange)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refreshInstalled])

  useEffect(() => {
    setCurrentStep(0)
  }, [session?.user?.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isInstallGateSkipped()) return
    if (!session?.user?.id) return
    if (isInstalled !== false) return

    const userAgent = window.navigator.userAgent.toLowerCase()
    setIsIOS(/iphone|ipad|ipod/.test(userAgent))

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [session?.user?.id, isInstalled])

  const skipGate = isInstallGateSkipped()
  const showGate =
    status === 'authenticated' &&
    !!session?.user?.id &&
    isInstalled === false &&
    !skipGate

  useEffect(() => {
    if (!showGate) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [showGate])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') {
      refreshInstalled()
    }
  }

  const nextStep = () => {
    setCurrentStep((s) => s + 1)
  }

  const prevStep = () => {
    setCurrentStep((s) => Math.max(0, s - 1))
  }

  if (!showGate) return null

  const iosSteps = [
    {
      title: 'Installazione obbligatoria',
      description:
        'PizzaDOC va usato come app installata. Segui i passaggi e poi apri PizzaDOC dall’icona sulla Home.',
      icon: <Smartphone className="w-16 h-16 text-orange-600" />,
      action: null as ReactNode,
      highlight: undefined as string | undefined
    },
    {
      title: 'Tocca Condividi',
      description: 'In Safari, tocca il pulsante di condivisione in basso.',
      icon: <Share2 className="w-16 h-16 text-blue-500" />,
      action: null,
      highlight: 'Cerca il simbolo di condivisione in basso al centro.'
    },
    {
      title: 'Aggiungi alla Home',
      description: 'Scorri e scegli «Aggiungi a Home» o «Aggiungi alla schermata Home».',
      icon: <Home className="w-16 h-16 text-green-500" />,
      action: null,
      highlight: 'Poi conferma con «Aggiungi».'
    },
    {
      title: 'Apri dall’icona',
      description:
        'Chiudi questa scheda Safari e avvia PizzaDOC toccando l’icona sulla Home: solo così potrai entrare.',
      icon: <CheckCircle className="w-16 h-16 text-orange-600" />,
      action: null,
      highlight: 'Se resti in Safari, il blocco resterà attivo finché non usi l’app installata.'
    }
  ]

  const androidSteps = [
    {
      title: 'Installazione obbligatoria',
      description:
        'Installa PizzaDOC come app dal browser. Senza installazione non è possibile continuare.',
      icon: <Smartphone className="w-16 h-16 text-orange-600" />,
      action: deferredPrompt ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full mt-4 px-6 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          Installa ora
        </button>
      ) : (
        <p className="mt-4 text-sm text-gray-500">
          Se non vedi il pulsante, apri il menu del browser (⋮) e scegli «Installa app» o «Aggiungi a schermata Home».
        </p>
      ),
      highlight: undefined as string | undefined
    },
    {
      title: 'Conferma l’installazione',
      description: 'Accetta la richiesta del browser per completare l’installazione.',
      icon: <Chrome className="w-16 h-16 text-blue-500" />,
      action: null,
      highlight: 'Su Android spesso trovi anche «Installa app» nel menu ⋮ in alto a destra.'
    },
    {
      title: 'Apri l’app installata',
      description:
        'Dopo l’installazione apri PizzaDOC dall’icona sulla Home o dal drawer app. Se sei ancora nel browser, tocca «Ho già installato» per ricontrollare.',
      icon: <CheckCircle className="w-16 h-16 text-green-500" />,
      action: (
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => refreshInstalled()}
            className="w-full px-6 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform"
          >
            Ho già installato — ricontrolla
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 text-sm font-bold text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-50"
          >
            Ricarica la pagina
          </button>
        </div>
      ),
      highlight: undefined
    }
  ]

  const steps = isIOS ? iosSteps : androidSteps
  const lastIndex = steps.length - 1
  const safeStep = Math.min(currentStep, lastIndex)
  const step = steps[safeStep]

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100000] animate-fade-in"
        aria-hidden
      />

      <div
        className="fixed inset-0 z-[100001] flex items-center justify-center p-4 pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-title"
      >
        <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
          <div className="p-8 text-center overflow-y-auto flex-1 min-h-0">
            <div className="flex justify-center mb-6 animate-bounce-slow">{step.icon}</div>

            <div className="flex justify-center gap-2 mb-4">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index === safeStep ? 'w-8 bg-orange-600' : 'w-2 bg-gray-300'
                  }`}
                />
              ))}
            </div>

            <h2 id="pwa-install-title" className="text-2xl font-black text-gray-900 mb-3">
              {step.title}
            </h2>

            <p className="text-gray-600 mb-4 text-base">{step.description}</p>

            {step.highlight && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 mb-4 text-left">
                <p className="text-sm font-bold text-orange-900">{step.highlight}</p>
              </div>
            )}

            {step.action}
          </div>

          <div className="border-t border-gray-100 p-4 flex justify-between items-center bg-gray-50 flex-shrink-0">
            <button
              type="button"
              onClick={prevStep}
              disabled={safeStep === 0}
              className={`px-4 py-2 font-bold rounded-lg transition-colors ${
                safeStep === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              ← Indietro
            </button>

            <span className="text-sm font-bold text-gray-500">
              {safeStep + 1} / {steps.length}
            </span>

            {safeStep < lastIndex ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-4 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors"
              >
                Avanti →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => refreshInstalled()}
                className="px-4 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors"
              >
                Ricontrolla
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
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
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
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
