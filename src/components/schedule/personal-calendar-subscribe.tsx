'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Download, Link2, RefreshCw, Smartphone } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type CalendarUrls = {
  httpsUrl: string
  webcalUrl: string
}

function googleCalendarSubscribeUrl(httpsUrl: string): string {
  // Google Calendar "Add by URL" deep link (works on Android browser / desktop)
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(httpsUrl)}`
}

export function PersonalCalendarSubscribe() {
  const [urls, setUrls] = useState<CalendarUrls | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const { showToast, ToastContainer } = useToast()

  const fetchUrls = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/user/calendar', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      setUrls({ httpsUrl: data.httpsUrl, webcalUrl: data.webcalUrl })
    } catch {
      showToast('Impossibile caricare il link calendario', 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showToast is unstable; mount-only fetch
  }, [])

  useEffect(() => {
    fetchUrls()
  }, [fetchUrls])

  const copyLink = async () => {
    if (!urls) return
    try {
      await navigator.clipboard.writeText(urls.httpsUrl)
      showToast('Link copiato', 'success')
    } catch {
      showToast('Copia non riuscita', 'error')
    }
  }

  const regenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch('/api/user/calendar', { method: 'POST' })
      if (!res.ok) throw new Error('regen failed')
      const data = await res.json()
      setUrls({ httpsUrl: data.httpsUrl, webcalUrl: data.webcalUrl })
      showToast('Nuovo link generato — risottoscrivi su iPhone o Google', 'success')
    } catch {
      showToast('Errore nella rigenerazione', 'error')
      throw new Error('regen failed')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="pd-card px-4 py-4 sm:px-5">
      <ToastContainer />
      <ConfirmDialog
        isOpen={showRegenConfirm}
        onClose={() => setShowRegenConfirm(false)}
        onConfirm={regenerate}
        title="Rigenera link calendario"
        description="Rigenerare il link invalida la sottoscrizione attuale su iPhone e Google Calendar. Continuare?"
        confirmLabel="Rigenera"
        isDangerous
        isLoading={regenerating}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="pd-display text-base font-semibold flex items-center gap-2">
            <Smartphone className="h-5 w-5 shrink-0" style={{ color: 'var(--pd-accent)' }} />
            Calendario personale
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--pd-muted)' }}>
            Sottoscrivi i tuoi turni su iPhone (Apple Calendario) o Android (Google Calendar).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="text-sm font-medium shrink-0 self-start"
          style={{ color: 'var(--pd-accent)' }}
        >
          {showHelp ? 'Nascondi guida' : 'Come fare (iPhone / Android)'}
        </button>
      </div>

      {showHelp && (
        <div
          className="mt-3 text-sm space-y-3 rounded-lg px-3 py-3 border"
          style={{ background: 'var(--pd-accent-soft)', borderColor: 'var(--pd-border)', color: 'var(--pd-text)' }}
        >
          <div>
            <p className="font-semibold text-gray-900 mb-1">iPhone / Apple Calendario</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Tocca «Apri in Calendario Apple» sul telefono, oppure copia il link.</li>
              <li>
                In alternativa: Impostazioni → Calendario → Account → Aggiungi account → Altro →
                Aggiungi calendario con iscrizione, e incolla il link HTTPS.
              </li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-1">Android / Google Calendar</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Tocca «Aggiungi a Google Calendar» (si apre Google Calendar nel browser).</li>
              <li>
                Oppure: apri{' '}
                <span className="font-medium">calendar.google.com</span> → impostazioni (ingranaggio)
                → Aggiungi calendario → Da URL → incolla il link HTTPS sotto.
              </li>
              <li>
                Sul telefono Android i turni compaiono nell’app Google Calendar dopo la sync
                (stesso account Google).
              </li>
            </ol>
          </div>
          <p className="text-gray-600">
            Il calendario «PizzaDOC» si aggiorna automaticamente su entrambi.
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {loading || !urls ? (
          <div className="h-9 w-40 rounded-lg bg-gray-100 animate-pulse" />
        ) : (
          <>
            <a
              href={urls.webcalUrl}
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 transition-colors pd-btn-primary"
            >
              <Link2 className="h-4 w-4" />
              Apri in Calendario Apple
            </a>
            <a
              href={googleCalendarSubscribeUrl(urls.httpsUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white hover:bg-gray-50 text-gray-900 text-sm font-semibold px-4 py-2 transition-colors border border-gray-300"
            >
              <Link2 className="h-4 w-4 text-blue-600" />
              Aggiungi a Google Calendar
            </a>
            <Button type="button" variant="outline" onClick={copyLink} className="gap-2">
              <Copy className="h-4 w-4" />
              Copia link
            </Button>
            <a
              href={urls.httpsUrl}
              download
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-sm font-medium px-4 py-2 transition-colors"
            >
              <Download className="h-4 w-4" />
              Scarica .ics
            </a>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRegenConfirm(true)}
              disabled={regenerating}
              isLoading={regenerating}
              className="gap-2 text-gray-600"
            >
              <RefreshCw className="h-4 w-4" />
              Rigenera link
            </Button>
          </>
        )}
      </div>

      {urls && !loading && (
        <p className="mt-2 text-xs text-gray-500 break-all select-all">{urls.httpsUrl}</p>
      )}
    </div>
  )
}
