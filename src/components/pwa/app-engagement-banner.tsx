'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import {
  Smartphone,
  Download,
  Share2,
  Home,
  Chrome,
  CheckCircle,
  Bell,
  X,
  Loader2,
  ChevronRight
} from 'lucide-react'
import { isAdmin } from '@/lib/auth-utils'
import { getClientDisplayMode } from '@/lib/client-display-mode'
import { isPwaNudgeDisabledByEnv } from '@/lib/pwa-nudge-env'
import { detectPushSetupGap, type PushSetupGap } from '@/lib/push-setup-status'
import { usePushNotifications } from '@/components/notifications/notification-bell'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type EngagementBranch = {
  snoozeCount: number
  snoozedUntil: string | null
  hiddenNow: boolean
  snoozesRemaining: number
  canSnooze: boolean
}

type EngagementState = {
  maxSnoozesPerType: number
  pwa: EngagementBranch
  push: EngagementBranch
}

export function AppEngagementBanner() {
  const { data: session, status } = useSession()
  const [pushGap, setPushGap] = useState<PushSetupGap>('none')
  const [serverPushOk, setServerPushOk] = useState(true)
  const [engagement, setEngagement] = useState<EngagementState | null>(null)
  const [renderKey, setRenderKey] = useState(0)
  const [showWizard, setShowWizard] = useState(false)
  const [showDeniedHelp, setShowDeniedHelp] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const { subscribe, isLoading: pushLoading, error: pushError } = usePushNotifications()

  const refreshPushGap = useCallback(async () => {
    setPushGap(await detectPushSetupGap())
  }, [])

  const refreshEngagement = useCallback(() => {
    if (status !== 'authenticated' || !session?.user?.id || isAdmin(session)) return
    void fetch('/api/user/engagement-state')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: EngagementState | null) => {
        if (d) setEngagement(d)
      })
      .catch(() => {})
  }, [status, session])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || isAdmin(session)) return
    refreshEngagement()
  }, [status, session?.user?.id, refreshEngagement])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || isAdmin(session)) return
    void refreshPushGap()
    const iv = window.setInterval(() => void refreshPushGap(), 90_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshPushGap()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [status, session, refreshPushGap])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || isAdmin(session)) return
    void fetch('/api/user/push-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.pushNotificationsEnabled === false) setServerPushOk(false)
        else setServerPushOk(true)
      })
      .catch(() => setServerPushOk(true))
  }, [status, session?.user?.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (status !== 'authenticated' || !session?.user?.id || isAdmin(session)) return
    if (isPwaNudgeDisabledByEnv()) return
    if (getClientDisplayMode() !== 'browser') return

    const ua = window.navigator.userAgent.toLowerCase()
    setIsIOS(/iphone|ipad|ipod/.test(ua))

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [status, session])

  const bump = () => setRenderKey((k) => k + 1)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const refresh = () => bump()
    window.addEventListener('appinstalled', refresh)
    const mq1 = window.matchMedia('(display-mode: standalone)')
    const mq2 = window.matchMedia('(display-mode: fullscreen)')
    mq1.addEventListener('change', refresh)
    mq2.addEventListener('change', refresh)
    return () => {
      window.removeEventListener('appinstalled', refresh)
      mq1.removeEventListener('change', refresh)
      mq2.removeEventListener('change', refresh)
    }
  }, [])

  const inBrowser =
    typeof window !== 'undefined' && getClientDisplayMode() === 'browser'

  const pwaHiddenByServer = engagement?.pwa.hiddenNow === true
  const pushHiddenByServer = engagement?.push.hiddenNow === true

  const showPwa =
    status === 'authenticated' &&
    session?.user?.id &&
    !isAdmin(session) &&
    !isPwaNudgeDisabledByEnv() &&
    inBrowser &&
    !pwaHiddenByServer

  const showPush =
    status === 'authenticated' &&
    session?.user?.id &&
    !isAdmin(session) &&
    serverPushOk &&
    pushGap !== 'none' &&
    !pushHiddenByServer

  if (!showPwa && !showPush) return null

  const maxS = engagement?.maxSnoozesPerType ?? 7

  const onSnoozePwa = async () => {
    const res = await fetch('/api/user/engagement-snooze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pwa' })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(typeof data.error === 'string' ? data.error : 'Impossibile posticipare.')
      return
    }
    if (data.pwa && data.push) {
      setEngagement({
        maxSnoozesPerType: data.maxSnoozesPerType,
        pwa: data.pwa,
        push: data.push
      })
    } else refreshEngagement()
    bump()
  }

  const onSnoozePush = async () => {
    const res = await fetch('/api/user/engagement-snooze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'push' })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(typeof data.error === 'string' ? data.error : 'Impossibile posticipare.')
      return
    }
    if (data.pwa && data.push) {
      setEngagement({
        maxSnoozesPerType: data.maxSnoozesPerType,
        pwa: data.pwa,
        push: data.push
      })
    } else refreshEngagement()
    bump()
  }

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') {
      bump()
      refreshEngagement()
    }
  }

  const onEnablePush = async () => {
    if (pushGap === 'request') {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        const ok = await subscribe()
        if (ok) {
          void refreshPushGap()
          refreshEngagement()
        }
      } else void refreshPushGap()
      return
    }
    if (pushGap === 'subscribe') {
      const ok = await subscribe()
      if (ok) {
        void refreshPushGap()
        refreshEngagement()
      }
      return
    }
    if (pushGap === 'denied') setShowDeniedHelp(true)
  }

  return (
    <>
      <div
        key={renderKey}
        className="rounded-2xl border border-orange-200/90 bg-gradient-to-br from-orange-50 via-white to-amber-50/90 p-4 shadow-md shadow-orange-500/5 space-y-4 mb-4"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-black text-orange-800/70 uppercase tracking-[0.2em]">
            Consigliato per tutta la squadra
          </p>
          <p className="text-[9px] font-semibold text-orange-900/60">
            Posticipa &quot;Più tardi&quot;: max {maxS} volte per app e max {maxS} per notifiche (24h ciascuna), poi serve
            completare la configurazione.
          </p>
        </div>

        {showPwa && (
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-200">
              <Smartphone className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-black text-gray-900">Usa PizzaDOC come app installata</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Dal browser le notifiche e l’esperienza sono meno stabili. Installando l’app dalla schermata Home è più
                semplice seguire turni e avvisi.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWizard(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-md active:scale-[0.98]"
                >
                  Come installare
                  <ChevronRight className="h-4 w-4" />
                </button>
                {deferredPrompt && (
                  <button
                    type="button"
                    onClick={() => void handleNativeInstall()}
                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-orange-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wide text-orange-700 active:scale-[0.98]"
                  >
                    <Download className="h-4 w-4" />
                    Installa ora
                  </button>
                )}
                {engagement == null || engagement.pwa.canSnooze ? (
                  <button
                    type="button"
                    onClick={() => void onSnoozePwa()}
                    className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 underline decoration-gray-300 underline-offset-2 hover:text-gray-600"
                  >
                    Più tardi (24h) — restano {engagement?.pwa.snoozesRemaining ?? maxS}/{maxS}
                  </button>
                ) : (
                  <span className="px-1 text-[9px] font-bold uppercase tracking-wide text-amber-800/70">
                    Posticipazioni app esaurite ({engagement.pwa.snoozeCount}/{maxS})
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {showPwa && showPush && <div className="border-t border-orange-100" />}

        {showPush && (
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-200">
              <Bell className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-black text-gray-900">Attiva le notifiche push</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                {pushGap === 'denied' &&
                  'Le notifiche risultano bloccate per questo sito: abilitale dalle impostazioni del telefono o del browser.'}
                {pushGap === 'request' && 'Consenti le notifiche per ricevere turni, sostituzioni e messaggi anche a app chiusa.'}
                {pushGap === 'subscribe' &&
                  'Hai già consentito le notifiche: completa l’iscrizione push con un tap per non perdere gli avvisi.'}
              </p>
              {pushError && <p className="text-xs font-semibold text-red-600">{pushError}</p>}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {pushGap !== 'denied' && (
                  <button
                    type="button"
                    disabled={pushLoading}
                    onClick={() => void onEnablePush()}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-md disabled:opacity-60 active:scale-[0.98]"
                  >
                    {pushLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {pushGap === 'subscribe' ? 'Completa iscrizione' : 'Consenti notifiche'}
                  </button>
                )}
                {pushGap === 'denied' && (
                  <button
                    type="button"
                    onClick={() => setShowDeniedHelp(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-md"
                  >
                    Come abilitarle
                  </button>
                )}
                {engagement == null || engagement.push.canSnooze ? (
                  <button
                    type="button"
                    onClick={() => void onSnoozePush()}
                    className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 underline decoration-gray-300 underline-offset-2 hover:text-gray-600"
                  >
                    Più tardi (24h) — restano {engagement?.push.snoozesRemaining ?? maxS}/{maxS}
                  </button>
                ) : (
                  <span className="px-1 text-[9px] font-bold uppercase tracking-wide text-amber-800/70">
                    Posticipazioni notifiche esaurite ({engagement.push.snoozeCount}/{maxS})
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <PwaInstallWizardModal
        open={showWizard}
        onClose={() => setShowWizard(false)}
        isIOS={isIOS}
        deferredPrompt={deferredPrompt}
        onNativeInstall={() => void handleNativeInstall()}
      />

      <Modal
        isOpen={showDeniedHelp}
        onClose={() => setShowDeniedHelp(false)}
        title="Riattivare le notifiche"
        subtitle="Dal browser o dal sistema"
        maxWidth="sm"
        zIndex={100060}
        headerIcon={<Bell className="h-8 w-8" />}
      >
        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600">
          <li>
            <strong className="text-gray-800">Android / Chrome:</strong> ⋮ sito → Impostazioni → Notifiche → Consenti.
          </li>
          <li>
            <strong className="text-gray-800">iPhone:</strong> Impostazioni → Safari / PizzaDOC → Notifiche.
          </li>
          <li>
            <strong className="text-gray-800">Desktop:</strong> icona lucchetto → Impostazioni sito → Notifiche.
          </li>
        </ul>
        <button
          type="button"
          onClick={() => setShowDeniedHelp(false)}
          className="mt-6 w-full rounded-2xl bg-gray-900 py-3 text-sm font-black uppercase tracking-wide text-white"
        >
          Ho capito
        </button>
      </Modal>
    </>
  )
}

function PwaInstallWizardModal({
  open,
  onClose,
  isIOS,
  deferredPrompt,
  onNativeInstall
}: {
  open: boolean
  onClose: () => void
  isIOS: boolean
  deferredPrompt: BeforeInstallPromptEvent | null
  onNativeInstall: () => void
}) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  if (!open) return null

  const iosSteps: { title: string; description: string; icon: ReactNode; highlight?: string; action?: ReactNode }[] = [
    {
      title: 'Installa PizzaDOC',
      description: 'Aggiungi l’app alla Home per un accesso rapido e notifiche più affidabili.',
      icon: <Smartphone className="w-14 h-14 text-orange-600" />
    },
    {
      title: 'Tocca Condividi',
      description: 'In Safari, usa il pulsante di condivisione in basso.',
      icon: <Share2 className="w-14 h-14 text-blue-500" />,
      highlight: 'Simbolo condividi al centro in basso.'
    },
    {
      title: 'Aggiungi a Home',
      description: 'Scegli «Aggiungi a Home» e conferma.',
      icon: <Home className="w-14 h-14 text-green-500" />
    },
    {
      title: 'Apri dall’icona',
      description: 'Per la migliore esperienza, avvia PizzaDOC dall’icona sulla Home.',
      icon: <CheckCircle className="w-14 h-14 text-orange-600" />
    }
  ]

  const androidSteps: { title: string; description: string; icon: ReactNode; highlight?: string; action?: ReactNode }[] =
    [
      {
        title: 'Installa PizzaDOC',
        description: 'L’app installata offre un’esperienza più stabile per turni e messaggi.',
        icon: <Smartphone className="w-14 h-14 text-orange-600" />,
        action: deferredPrompt ? (
          <button
            type="button"
            onClick={() => void onNativeInstall()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-black text-white shadow-lg"
          >
            <Download className="h-5 w-5" />
            Installa con il browser
          </button>
        ) : (
          <p className="mt-3 text-left text-xs text-gray-500">
            Menu ⋮ → «Installa app» o «Aggiungi a schermata Home».
          </p>
        )
      },
      {
        title: 'Conferma',
        description: 'Accetta il prompt del browser per completare l’installazione.',
        icon: <Chrome className="w-14 h-14 text-blue-500" />
      },
      {
        title: 'Fatto',
        description: 'Apri PizzaDOC dall’icona sulla Home quando vuoi.',
        icon: <CheckCircle className="w-14 h-14 text-green-500" />
      }
    ]

  const steps = isIOS ? iosSteps : androidSteps
  const last = steps.length - 1
  const s = Math.min(step, last)
  const cur = steps[s]

  return (
    <div className="fixed inset-0 z-[100090] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Chiudi"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-gray-100 p-2 text-gray-600 hover:bg-gray-200"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="overflow-y-auto p-6 pt-12 text-center">
          <div className="mb-4 flex justify-center">{cur.icon}</div>
          <div className="mb-3 flex justify-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn('h-1.5 rounded-full transition-all', i === s ? 'w-6 bg-orange-600' : 'w-1.5 bg-gray-200')}
              />
            ))}
          </div>
          <h2 className="text-xl font-black text-gray-900">{cur.title}</h2>
          <p className="mt-2 text-sm text-gray-600">{cur.description}</p>
          {cur.highlight && (
            <p className="mt-3 rounded-xl border border-orange-100 bg-orange-50 p-3 text-xs font-bold text-orange-900">
              {cur.highlight}
            </p>
          )}
          {cur.action}
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-3">
          <button
            type="button"
            disabled={s === 0}
            onClick={() => setStep((x) => Math.max(0, x - 1))}
            className={cn(
              'text-sm font-bold',
              s === 0 ? 'text-gray-300' : 'text-gray-700 hover:underline'
            )}
          >
            Indietro
          </button>
          <span className="text-xs font-bold text-gray-400">
            {s + 1} / {steps.length}
          </span>
          {s < last ? (
            <button
              type="button"
              onClick={() => setStep((x) => x + 1)}
              className="text-sm font-black text-orange-600"
            >
              Avanti
            </button>
          ) : (
            <button type="button" onClick={onClose} className="text-sm font-black text-orange-600">
              Chiudi
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
