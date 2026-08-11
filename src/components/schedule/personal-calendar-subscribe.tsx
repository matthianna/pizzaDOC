'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Copy, Download, Link2, RefreshCw, Smartphone } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'

type CalendarUrls = {
  httpsUrl: string
  webcalUrl: string
}

function googleCalendarSubscribeUrl(httpsUrl: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(httpsUrl)}`
}

export function PersonalCalendarSubscribe() {
  const [urls, setUrls] = useState<CalendarUrls | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [open, setOpen] = useState(false)
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

  const secondaryBtn = {
    background: 'var(--pd-surface)',
    border: '1px solid var(--pd-border)',
    borderRadius: 'var(--pd-radius-pill)',
    color: 'var(--pd-text)',
  } as const

  return (
    <div
      className="overflow-hidden"
      style={{
        background: 'var(--pd-surface)',
        border: '1px solid var(--pd-border)',
        borderRadius: 'var(--pd-radius-lg)',
        boxShadow: 'var(--pd-shadow)',
      }}
    >
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

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left pd-press"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Smartphone className="h-5 w-5 shrink-0" style={{ color: 'var(--pd-accent)' }} />
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
              Calendario personale
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
              Sottoscrivi i turni su iPhone o Google Calendar
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 transition-transform', open && 'rotate-180')}
          style={{ color: 'var(--pd-muted)' }}
        />
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--pd-border)' }}>
          <div className="px-4 py-4 space-y-3">
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="text-xs font-semibold"
              style={{ color: 'var(--pd-accent)' }}
            >
              {showHelp ? 'Nascondi guida' : 'Come fare (iPhone / Android)'}
            </button>

            {showHelp && (
              <div
                className="text-sm space-y-3 px-3 py-3"
                style={{
                  background: 'var(--pd-surface-muted)',
                  borderRadius: 'var(--pd-radius)',
                  border: '1px solid var(--pd-border)',
                  color: 'var(--pd-text)',
                }}
              >
                <div>
                  <p className="font-semibold mb-1">iPhone / Apple Calendario</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs" style={{ color: 'var(--pd-muted)' }}>
                    <li>Tocca «Apri in Calendario Apple» sul telefono, oppure copia il link.</li>
                    <li>
                      In alternativa: Impostazioni → Calendario → Account → Aggiungi account → Altro →
                      Aggiungi calendario con iscrizione, e incolla il link HTTPS.
                    </li>
                  </ol>
                </div>
                <div>
                  <p className="font-semibold mb-1">Android / Google Calendar</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs" style={{ color: 'var(--pd-muted)' }}>
                    <li>Tocca «Aggiungi a Google Calendar» (si apre Google Calendar nel browser).</li>
                    <li>
                      Oppure: calendar.google.com → impostazioni → Aggiungi calendario → Da URL →
                      incolla il link HTTPS.
                    </li>
                  </ol>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {loading || !urls ? (
                <div
                  className="h-9 w-40 animate-pulse"
                  style={{ background: 'var(--pd-surface-muted)', borderRadius: 'var(--pd-radius)' }}
                />
              ) : (
                <>
                  <a
                    href={urls.webcalUrl}
                    className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 pd-btn-primary"
                  >
                    <Link2 className="h-4 w-4" />
                    Calendario Apple
                  </a>
                  <a
                    href={googleCalendarSubscribeUrl(urls.httpsUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 pd-press"
                    style={secondaryBtn}
                  >
                    <Link2 className="h-4 w-4" style={{ color: 'var(--pd-accent)' }} />
                    Google Calendar
                  </a>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 pd-press"
                    style={secondaryBtn}
                  >
                    <Copy className="h-4 w-4" />
                    Copia link
                  </button>
                  <a
                    href={urls.httpsUrl}
                    download
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 pd-press"
                    style={secondaryBtn}
                  >
                    <Download className="h-4 w-4" />
                    Scarica .ics
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowRegenConfirm(true)}
                    disabled={regenerating}
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 pd-press disabled:opacity-50"
                    style={secondaryBtn}
                  >
                    <RefreshCw className={cn('h-4 w-4', regenerating && 'animate-spin')} />
                    Rigenera
                  </button>
                </>
              )}
            </div>

            {urls && !loading && (
              <p className="text-[11px] break-all select-all" style={{ color: 'var(--pd-muted)' }}>
                {urls.httpsUrl}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
