'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { SectionBlock } from '@/components/ui/section-block'
import {
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Calendar,
  Clock,
  Bell,
  Users,
  MessageSquare,
  History,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [url, setUrl] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [showLists, setShowLists] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; recipients?: number; pushResult?: any } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeQuick, setActiveQuick] = useState<string | null>(null)

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const response = await fetch('/api/notifications/broadcast')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    if (filter && (filter === 'missing_availability' || filter === 'missing_hours')) {
      fetchStats()
    } else {
      setStats(null)
      setShowLists(false)
    }
  }, [filter])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !message) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, url, filter })
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
        setTitle('')
        setMessage('')
        setUrl('')
        setFilter(null)
        setActiveQuick(null)
      } else {
        setError(data.error || "Errore durante l'invio")
      }
    } catch (err) {
      setError('Errore di connessione')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const quickActions = [
    {
      id: 'missing_availability',
      icon: Calendar,
      title: 'Richiedi disponibilità',
      subtitle: 'Solo chi non ha ancora inserito',
      action: () => {
        setTitle('Inserimento Disponibilità')
        setMessage('È ora di inserire le tue disponibilità per la prossima settimana. Grazie!')
        setUrl('/availability')
        setFilter('missing_availability')
        setActiveQuick('missing_availability')
      }
    },
    {
      id: 'missing_hours',
      icon: Clock,
      title: 'Sollecito ore (admin)',
      subtitle: 'Avvisa gli amministratori',
      action: () => {
        setTitle('Ore: richiesta agli amministratori')
        setMessage(
          'Ci sono dipendenti con turni passati senza ore registrate o con ore rifiutate. Apri Gestione ore per completarle.'
        )
        setUrl('/admin/hours')
        setFilter('missing_hours')
        setActiveQuick('missing_hours')
        fetchStats()
      }
    },
    {
      id: 'new_plan',
      icon: Bell,
      title: 'Nuovo piano',
      subtitle: 'Invia a tutta la squadra',
      action: () => {
        setTitle('Piano Pubblicato')
        setMessage('Il nuovo piano settimanale è online. Controlla i tuoi turni!')
        setUrl('/weekly-plan')
        setFilter(null)
        setActiveQuick('new_plan')
      }
    },
    {
      id: 'custom',
      icon: MessageSquare,
      title: 'Messaggio libero',
      subtitle: 'Pulisci tutti i campi',
      action: () => {
        setTitle('')
        setMessage('')
        setUrl('')
        setFilter(null)
        setActiveQuick('custom')
      }
    }
  ]

  const inputStyle = {
    borderColor: 'var(--pd-border)',
    borderRadius: 'var(--pd-radius)',
    background: 'var(--pd-surface-muted)',
    color: 'var(--pd-text)',
  } as const

  return (
    <MainLayout adminOnly contentWidth="6xl">
      <div className="pd-page">
        <PageHeader
          dense
          title="Invia broadcast"
          subtitle="Notifica la squadra con un messaggio mirato o libero"
          action={
            <Link
              href="/admin/notifications/all"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border"
              style={{
                borderColor: 'var(--pd-border)',
                borderRadius: 'var(--pd-radius)',
                background: 'var(--pd-surface)',
                color: 'var(--pd-text)',
              }}
            >
              <History className="h-4 w-4" />
              Storico
            </Link>
          }
        />

        <SectionBlock title="Azioni rapide" subtitle="Precompila titolo, messaggio e filtro">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {quickActions.map(action => {
              const isActive = activeQuick === action.id
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={action.action}
                  className={cn(
                    'flex flex-col items-start text-left p-4 border transition-colors'
                  )}
                  style={{
                    borderRadius: 'var(--pd-radius-lg)',
                    borderColor: isActive ? 'var(--pd-accent)' : 'var(--pd-border)',
                    background: isActive ? 'var(--pd-accent-soft)' : 'var(--pd-surface)',
                    boxShadow: isActive ? 'none' : 'var(--pd-shadow)',
                  }}
                >
                  <action.icon
                    className="h-5 w-5 mb-3"
                    style={{ color: isActive ? 'var(--pd-accent)' : 'var(--pd-muted)' }}
                  />
                  <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                    {action.title}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--pd-muted)' }}>
                    {action.subtitle}
                  </p>
                </button>
              )
            })}
          </div>
        </SectionBlock>

        {filter && (filter === 'missing_availability' || filter === 'missing_hours') && (
          <SectionBlock
            title="Filtro attivo"
            subtitle={
              filter === 'missing_availability'
                ? 'Solo chi non ha inserito la disponibilità'
                : 'Destinatari: amministratori. Sotto: staff con turni senza ore.'
            }
            action={
              <button
                type="button"
                onClick={() => {
                  setFilter(null)
                  setActiveQuick(null)
                }}
                className="text-xs font-semibold px-3 py-1.5"
                style={{
                  color: 'var(--pd-accent)',
                  background: 'var(--pd-accent-soft)',
                  borderRadius: 'var(--pd-radius)',
                }}
              >
                Rimuovi
              </button>
            }
            card
          >
            <div className="p-4">
              {statsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--pd-accent)' }} />
                </div>
              ) : stats ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowLists(!showLists)}
                    className="w-full flex items-center justify-between text-sm"
                    style={{ color: 'var(--pd-muted)' }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {filter === 'missing_availability'
                        ? stats.availability?.missing.length
                        : stats.hours?.adminNotifyRecipients?.length}{' '}
                      destinatari
                    </span>
                    <span className="font-medium" style={{ color: 'var(--pd-accent)' }}>
                      {showLists ? 'Nascondi' : 'Mostra'}
                    </span>
                  </button>

                  {showLists && (
                    <div
                      className="mt-4 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4"
                      style={{ borderTop: '1px solid var(--pd-border)' }}
                    >
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--pd-danger)' }}>
                          {filter === 'missing_hours' ? 'Staff (ore da registrare)' : 'Mancano'}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(filter === 'missing_availability'
                            ? stats.availability?.missing
                            : stats.hours?.missing
                          )?.map((name: string) => (
                            <span
                              key={name}
                              className="px-2 py-1 text-xs font-medium"
                              style={{
                                background: 'var(--pd-danger-soft)',
                                color: 'var(--pd-danger)',
                                borderRadius: 'var(--pd-radius)',
                              }}
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--pd-success)' }}>
                          {filter === 'missing_hours' ? 'Admin (ricevono la notifica)' : 'Inserito'}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(filter === 'missing_availability'
                            ? stats.availability?.submitted
                            : stats.hours?.adminNotifyRecipients
                          )?.map((name: string) => (
                            <span
                              key={name}
                              className="px-2 py-1 text-xs font-medium"
                              style={{
                                background: 'var(--pd-success-soft)',
                                color: 'var(--pd-success)',
                                borderRadius: 'var(--pd-radius)',
                              }}
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </SectionBlock>
        )}

        <SectionBlock title="Componi messaggio" card>
          <form onSubmit={handleSend} className="p-4 sm:p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--pd-muted)' }}>
                Titolo
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2"
                style={inputStyle}
                placeholder="Es: Aggiornamento importante"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--pd-muted)' }}>
                Messaggio
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full border px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 resize-none"
                style={inputStyle}
                placeholder="Scrivi il contenuto della notifica…"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--pd-muted)' }}>
                Link destinazione <span style={{ color: 'var(--pd-muted)', opacity: 0.7 }}>(opzionale)</span>
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full border px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2"
                style={inputStyle}
                placeholder="Es: /schedule"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !title || !message}
              className="w-full flex items-center justify-center gap-2 py-3.5 text-sm pd-btn-primary disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {filter ? 'Invia ai destinatari filtrati' : 'Invia a tutta la squadra'}
                </>
              )}
            </button>
          </form>
        </SectionBlock>

        {result && (
          <div
            className="flex items-start gap-3 p-4 border"
            style={{
              background: 'var(--pd-success-soft)',
              borderColor: 'var(--pd-border)',
              borderRadius: 'var(--pd-radius-lg)',
            }}
          >
            <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--pd-success)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--pd-success)' }}>
                Notifica inviata
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                {result.recipients} destinatari nel database · {result.pushResult?.successful || 0} push
                inviate
              </p>
            </div>
          </div>
        )}

        {error && (
          <div
            className="flex items-start gap-3 p-4 border"
            style={{
              background: 'var(--pd-danger-soft)',
              borderColor: 'var(--pd-border)',
              borderRadius: 'var(--pd-radius-lg)',
            }}
          >
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--pd-danger)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--pd-danger)' }}>Errore</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--pd-muted)' }}>{error}</p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
