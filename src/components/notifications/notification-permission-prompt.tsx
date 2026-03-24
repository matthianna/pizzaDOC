'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useSession } from 'next-auth/react'
import { BellOff } from 'lucide-react'
import { Modal } from '@/components/ui/modal'

function isDenied(): boolean {
  if (typeof window === 'undefined') return false
  if (!window.isSecureContext) return false
  return 'Notification' in window && Notification.permission === 'denied'
}

/**
 * When the user has blocked browser notifications, remind them while on the dashboard:
 * each visit remounts this component so the prompt can show again; also when returning
 * from background (visibility / BFCache) if still on this page.
 */
export function NotificationPermissionPrompt() {
  const { status } = useSession()
  const [open, setOpen] = useState(false)
  const hiddenAtRef = useRef<number | null>(null)
  const statusRef = useRef(status)
  statusRef.current = status

  const tryOpen = useCallback(() => {
    if (statusRef.current !== 'authenticated') return
    if (!isDenied()) return
    setOpen(true)
  }, [])

  // First paint / session ready after login
  useEffect(() => {
    if (status !== 'authenticated') return
    if (!isDenied()) return
    const t = window.setTimeout(() => tryOpen(), 400)
    return () => window.clearTimeout(t)
  }, [status, tryOpen])

  // PWA / tab: show again when coming back after being hidden briefly (avoids flicker on instant tab switches)
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
      const awayMs = Date.now() - hiddenAt
      if (awayMs < 1500) return
      tryOpen()
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [status, tryOpen])

  // Restored from back/forward cache
  useEffect(() => {
    if (status !== 'authenticated') return

    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      tryOpen()
    }

    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [status, tryOpen])

  if (!open) return null

  return (
    <Modal
      isOpen={open}
      onClose={() => setOpen(false)}
      title="Notifiche disattivate"
      subtitle="Abilitale per non perdere aggiornamenti"
      maxWidth="sm"
      headerIcon={<BellOff className="h-8 w-8" />}
    >
      <div className="space-y-4 text-gray-700 text-[15px] leading-relaxed">
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
            <strong className="text-gray-800">Safari (iOS):</strong> Impostazioni → Safari → Impostazioni sito web
            → Notifiche, oppure Impostazioni → [app] se installata come app.
          </li>
          <li>
            <strong className="text-gray-800">Desktop:</strong> icona del lucchetto o del sito nella barra degli
            indirizzi → Impostazioni sito → Notifiche.
          </li>
        </ul>
        <p className="text-sm text-gray-500">
          Questo promemoria comparirà di nuovo ogni volta che apri la dashboard finché le notifiche restano
          bloccate.
        </p>
      </div>
    </Modal>
  )
}
