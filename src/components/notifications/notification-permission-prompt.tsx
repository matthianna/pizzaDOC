'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useSession } from 'next-auth/react'
import { BellOff, Bell, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { usePushNotifications } from './notification-bell'

type PromptKind = 'denied' | 'request' | 'subscribe'

const MODAL_Z = 100050

async function detectPromptKind(): Promise<PromptKind | null> {
  if (typeof window === 'undefined' || !window.isSecureContext) return null
  if (!('Notification' in window)) return null

  const perm = Notification.permission
  if (perm === 'denied') return 'denied'
  if (perm === 'default') return 'request'

  if (perm !== 'granted') return null
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return 'subscribe'
  } catch {
    return 'subscribe'
  }

  return null
}

/**
 * Dashboard: remind users to enable notifications. Covers permission "default" (common in PWA
 * before first ask), "denied", and "granted" without a push subscription.
 */
export function NotificationPermissionPrompt() {
  const { status } = useSession()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<PromptKind>('request')
  const hiddenAtRef = useRef<number | null>(null)
  const statusRef = useRef(status)
  statusRef.current = status

  const { subscribe, isLoading, error } = usePushNotifications()

  const tryOpen = useCallback(async () => {
    if (statusRef.current !== 'authenticated') return
    const k = await detectPromptKind()
    if (k) {
      setKind(k)
      setOpen(true)
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    const t = window.setTimeout(() => {
      void tryOpen()
    }, 500)
    return () => window.clearTimeout(t)
  }, [status, tryOpen])

  useEffect(() => {
    if (status !== 'authenticated') return

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      const hiddenAt = hiddenAtRef.current
      hiddenAtRef.current = null
      if (hiddenAt == null) return
      if (Date.now() - hiddenAt < 1500) return
      void tryOpen()
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [status, tryOpen])

  useEffect(() => {
    if (status !== 'authenticated') return

    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      void tryOpen()
    }

    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [status, tryOpen])

  const onRequestPermission = async () => {
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      const ok = await subscribe()
      if (ok) setOpen(false)
      else {
        setKind('subscribe')
      }
    } else if (perm === 'denied') {
      setKind('denied')
    }
  }

  const onSubscribeOnly = async () => {
    const ok = await subscribe()
    if (ok) setOpen(false)
  }

  if (!open) return null

  const titles: Record<PromptKind, string> = {
    denied: 'Notifiche disattivate',
    request: 'Attiva le notifiche',
    subscribe: 'Completa l’iscrizione'
  }

  const subtitles: Record<PromptKind, string> = {
    denied: 'Abilitale per non perdere aggiornamenti',
    request: 'Ricevi avvisi su turni e messaggi importanti',
    subscribe: 'Il permesso è ok, manca solo l’iscrizione push'
  }

  return (
    <Modal
      isOpen={open}
      onClose={() => setOpen(false)}
      title={titles[kind]}
      subtitle={subtitles[kind]}
      maxWidth="sm"
      zIndex={MODAL_Z}
      headerIcon={
        kind === 'denied' ? <BellOff className="h-8 w-8" /> : <Bell className="h-8 w-8" />
      }
    >
      <div className="space-y-4 text-gray-700 text-[15px] leading-relaxed">
        {kind === 'request' && (
          <>
            <p>
              PizzaDOC può inviarti notifiche quando sei nell’app installata o nel browser. Tocca il pulsante
              qui sotto per consentire le notifiche, poi conferma nella finestra di sistema.
            </p>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void onRequestPermission()}
              className="w-full py-3 px-4 rounded-2xl bg-orange-600 text-white font-black text-sm uppercase tracking-wide shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              Consenti notifiche
            </button>
          </>
        )}

        {kind === 'subscribe' && (
          <>
            <p>
              Le notifiche sono consentite, ma l’iscrizione push non è ancora attiva. Completa l’attivazione per
              ricevere gli avvisi anche quando l’app è in background.
            </p>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void onSubscribeOnly()}
              className="w-full py-3 px-4 rounded-2xl bg-orange-600 text-white font-black text-sm uppercase tracking-wide shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              Attiva notifiche push
            </button>
          </>
        )}

        {kind === 'denied' && (
          <>
            <p>
              Hai bloccato le notifiche per questo sito. Per ricevere avvisi su turni, sostituzioni e messaggi
              importanti, devi riattivarle dalle impostazioni del browser o del sistema.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
              <li>
                <strong className="text-gray-800">Chrome / Edge (Android):</strong> menu del sito → Impostazioni
                sito → Notifiche → Consenti.
              </li>
              <li>
                <strong className="text-gray-800">Safari / Web app (iOS):</strong> Impostazioni → notifiche per
                PizzaDOC o per Safari → siti web.
              </li>
              <li>
                <strong className="text-gray-800">Desktop:</strong> icona del lucchetto nella barra indirizzi →
                Impostazioni sito → Notifiche.
              </li>
            </ul>
          </>
        )}

        {error && (
          <p className="text-sm text-red-600 font-semibold" role="alert">
            {error}
          </p>
        )}

        <p className="text-sm text-gray-500">
          Questo promemoria può comparire di nuovo quando torni sulla dashboard o sull’app finché le notifiche
          push non sono attive.
        </p>
      </div>
    </Modal>
  )
}
