'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Download, Link2, RefreshCw, Smartphone } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'

type CalendarUrls = {
  httpsUrl: string
  webcalUrl: string
}

export function PersonalCalendarSubscribe() {
  const [urls, setUrls] = useState<CalendarUrls | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
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
    if (
      !confirm(
        'Rigenerare il link invalida la sottoscrizione attuale su Calendario. Continuare?'
      )
    ) {
      return
    }
    setRegenerating(true)
    try {
      const res = await fetch('/api/user/calendar', { method: 'POST' })
      if (!res.ok) throw new Error('regen failed')
      const data = await res.json()
      setUrls({ httpsUrl: data.httpsUrl, webcalUrl: data.webcalUrl })
      showToast('Nuovo link generato — risottoscrivi su iPhone', 'success')
    } catch {
      showToast('Errore nella rigenerazione', 'error')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="glass rounded-xl shadow-soft border border-white/40 px-4 py-4 sm:px-5">
      <ToastContainer />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-orange-500 shrink-0" />
            Calendario personale
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Sottoscrivi i tuoi turni su Calendario (iPhone). Si aggiorna da solo quando cambia il
            piano settimanale. Pranzo fino alle 14:00, cena fino alle 22:00.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="text-sm font-medium text-orange-600 hover:text-orange-700 shrink-0 self-start"
        >
          {showHelp ? 'Nascondi guida' : 'Come fare su iPhone'}
        </button>
      </div>

      {showHelp && (
        <ol className="mt-3 text-sm text-gray-700 list-decimal list-inside space-y-1 bg-orange-50/60 rounded-lg px-3 py-3 border border-orange-100">
          <li>Tocca «Apri in Calendario» sul telefono, oppure copia il link.</li>
          <li>
            In alternativa: Impostazioni → Calendario → Account → Aggiungi account → Altro →
            Aggiungi calendario con iscrizione, e incolla il link HTTPS.
          </li>
          <li>Il calendario «PizzaDOC» si aggiorna automaticamente.</li>
        </ol>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {loading || !urls ? (
          <div className="h-9 w-40 rounded-lg bg-gray-100 animate-pulse" />
        ) : (
          <>
            <a
              href={urls.webcalUrl}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 transition-colors"
            >
              <Link2 className="h-4 w-4" />
              Apri in Calendario
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
              onClick={regenerate}
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
