'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useSession } from 'next-auth/react'
import { BellOff, Bell, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { usePushNotifications } from './notification-bell'
import { detectPushSetupGap, type PushSetupGap } from '@/lib/push-setup-status'

type PromptKind = Exclude<PushSetupGap, 'none'>

const MODAL_Z = 100050

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
    const gap = await detectPushSetupGap()
    if (gap === 'none') return
    setKind(gap)
    setOpen(true)
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
      else setKind('subscribe')
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
    denied: 'Notifiche bloccate',
    request: 'Resta aggiornato',
    subscribe: 'Quasi fatto',
  }

  const subtitles: Record<PromptKind, string> = {
    denied: 'Riattivale dalle impostazioni del dispositivo',
    request: 'Avvisi su turni, sostituzioni e messaggi',
    subscribe: 'Manca solo l’iscrizione push',
  }

  const Icon = kind === 'denied' ? BellOff : Bell

  return (
    <Modal
      isOpen={open}
      onClose={() => setOpen(false)}
      title={titles[kind]}
      subtitle={subtitles[kind]}
      maxWidth="sm"
      zIndex={MODAL_Z}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 w-11 h-11 flex items-center justify-center"
            style={{
              background: kind === 'denied' ? 'var(--pd-danger-soft)' : 'var(--pd-accent-soft)',
              color: kind === 'denied' ? 'var(--pd-danger)' : 'var(--pd-accent)',
              borderRadius: 'var(--pd-radius)',
            }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <p className="text-sm leading-relaxed pt-1" style={{ color: 'var(--pd-muted)' }}>
            {kind === 'request' &&
              'Consenti le notifiche per ricevere aggiornamenti anche quando l’app è chiusa. Conferma nella finestra di sistema dopo aver toccato il pulsante.'}
            {kind === 'subscribe' &&
              'Il permesso è già attivo. Completa l’iscrizione push per ricevere gli avvisi in background.'}
            {kind === 'denied' &&
              'Le notifiche sono disattivate per questo sito. Puoi riabilitarle così:'}
          </p>
        </div>

        {kind === 'denied' && (
          <div
            className="space-y-2.5 p-3.5 text-sm"
            style={{
              background: 'var(--pd-surface-muted)',
              borderRadius: 'var(--pd-radius)',
              border: '1px solid var(--pd-border)',
              color: 'var(--pd-muted)',
            }}
          >
            <p>
              <span className="font-semibold" style={{ color: 'var(--pd-text)' }}>
                Android · Chrome/Edge
              </span>
              <br />
              Menu del sito → Impostazioni sito → Notifiche → Consenti
            </p>
            <p>
              <span className="font-semibold" style={{ color: 'var(--pd-text)' }}>
                iPhone · Safari / PWA
              </span>
              <br />
              Impostazioni → Notifiche → Pizza D.O.C. (o Safari)
            </p>
            <p>
              <span className="font-semibold" style={{ color: 'var(--pd-text)' }}>
                Desktop
              </span>
              <br />
              Icona lucchetto nella barra indirizzi → Notifiche
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm font-semibold" role="alert" style={{ color: 'var(--pd-danger)' }}>
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 pt-1">
          {kind === 'request' && (
            <Button
              type="button"
              className="w-full"
              disabled={isLoading}
              isLoading={isLoading}
              onClick={() => void onRequestPermission()}
            >
              Consenti notifiche
            </Button>
          )}
          {kind === 'subscribe' && (
            <Button
              type="button"
              className="w-full"
              disabled={isLoading}
              isLoading={isLoading}
              onClick={() => void onSubscribeOnly()}
            >
              Attiva notifiche push
            </Button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full py-2.5 text-sm font-semibold pd-press"
            style={{
              color: 'var(--pd-muted)',
              background: 'var(--pd-surface-muted)',
              borderRadius: 'var(--pd-radius)',
            }}
          >
            {kind === 'denied' ? 'Ho capito' : 'Più tardi'}
          </button>
        </div>

        {kind !== 'denied' && (
          <p className="text-[11px] text-center leading-relaxed" style={{ color: 'var(--pd-muted)' }}>
            Puoi attivarle in qualsiasi momento dalle impostazioni del browser.
          </p>
        )}
      </div>
    </Modal>
  )
}
