'use client'

import { useState, useEffect, useMemo } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { SectionBlock } from '@/components/ui/section-block'
import { EmptyState } from '@/components/ui/list-row'
import {
  Activity,
  Database,
  Download,
  RefreshCw,
  HardDrive,
  ChevronDown,
  MapPin,
  Monitor,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { cn } from '@/lib/utils'
import {
  AUDIT_ACTION_LABELS,
  AUDIT_TONE_STYLE,
  formatAuditMetaValue,
  getAuditActionTone,
  labelAuditMetaKey,
} from '@/lib/audit-labels'
import { useToast } from '@/components/ui/toast'
import { ListRow } from '@/components/ui/list-row'

interface AuditLog {
  id: string
  userId: string
  userUsername: string
  action: string
  description: string
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  user: {
    id: string
    username: string
    primaryRole: string | null
  }
}

type TabId = 'logs' | 'backups'

const PAGE_SIZE = 30

function metaEntries(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || typeof metadata !== 'object') return []
  return Object.entries(metadata).filter(
    ([key, value]) =>
      value !== undefined &&
      value !== null &&
      key !== 'errors' &&
      !(typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0)
  )
}

function DiffBlock({
  label,
  value,
}: {
  label: string
  value: unknown
}) {
  if (value === undefined || value === null) return null
  const entries =
    typeof value === 'object' && !Array.isArray(value)
      ? Object.entries(value as Record<string, unknown>)
      : null

  return (
    <div
      className="rounded-lg p-3 space-y-1.5 min-w-0"
      style={{ background: 'var(--pd-surface-muted)', border: '1px solid var(--pd-border)' }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--pd-muted)' }}>
        {label}
      </p>
      {entries ? (
        <dl className="space-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 text-xs">
              <dt style={{ color: 'var(--pd-muted)' }}>{labelAuditMetaKey(k)}</dt>
              <dd className="font-medium text-right tabular-nums break-all" style={{ color: 'var(--pd-text)' }}>
                {formatAuditMetaValue(v)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs font-medium break-all" style={{ color: 'var(--pd-text)' }}>
          {formatAuditMetaValue(value)}
        </p>
      )}
    </div>
  )
}

function AuditLogRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false)
  const tone = getAuditActionTone(log.action)
  const toneStyle = AUDIT_TONE_STYLE[tone]
  const label = AUDIT_ACTION_LABELS[log.action] || log.action
  const metadata = log.metadata || {}
  const before = metadata.before
  const after = metadata.after
  const otherEntries = metaEntries(metadata).filter(([k]) => k !== 'before' && k !== 'after' && k !== 'tables')

  return (
    <div style={{ borderBottom: '1px solid var(--pd-border)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4 pd-press"
      >
        <div
          className="w-9 h-9 shrink-0 flex items-center justify-center text-xs font-semibold"
          style={{
            background: toneStyle.bg,
            color: toneStyle.color,
            borderRadius: '999px',
          }}
        >
          {log.userUsername.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex px-2 py-0.5 text-[11px] font-semibold"
              style={{
                background: toneStyle.bg,
                color: toneStyle.color,
                borderRadius: 'var(--pd-radius-pill)',
              }}
            >
              {label}
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--pd-muted)' }}>
              {format(new Date(log.createdAt), "EEE d MMM yyyy · HH:mm", { locale: it })}
            </span>
          </div>
          <p
            className={cn('text-sm font-medium', !open && 'line-clamp-2')}
            style={{ color: 'var(--pd-text)' }}
          >
            {log.description}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--pd-muted)' }}>
            <span>
              Autore <strong style={{ color: 'var(--pd-text)' }}>{log.userUsername}</strong>
            </span>
            {log.ipAddress ? (
              <span className="inline-flex items-center gap-1 font-mono">
                <MapPin className="h-3 w-3" />
                {log.ipAddress}
              </span>
            ) : null}
            {(metadata.targetUsername || metadata.username) ? (
              <span>
                Oggetto{' '}
                <strong style={{ color: 'var(--pd-text)' }}>
                  {String(metadata.targetUsername || metadata.username)}
                </strong>
              </span>
            ) : null}
          </div>
        </div>

        <ChevronDown
          className={cn('h-4 w-4 shrink-0 mt-1 transition-transform self-end sm:self-start', open && 'rotate-180')}
          style={{ color: 'var(--pd-muted)' }}
        />
      </button>

      {open ? (
        <div className="px-4 pb-4 pl-[3.75rem] space-y-3">
          {(before !== undefined || after !== undefined) && (
            <div className="grid gap-2 sm:grid-cols-2">
              <DiffBlock label="Prima" value={before} />
              <DiffBlock label="Dopo" value={after} />
            </div>
          )}

          {otherEntries.length > 0 ? (
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--pd-border)' }}
            >
              <div
                className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide"
                style={{ background: 'var(--pd-surface-muted)', color: 'var(--pd-muted)' }}
              >
                Dettagli
              </div>
              <dl className="divide-y" style={{ borderColor: 'var(--pd-border)' }}>
                {otherEntries.map(([key, value]) => (
                  <div key={key} className="px-3 py-2 flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4 text-xs">
                    <dt className="shrink-0" style={{ color: 'var(--pd-muted)' }}>
                      {labelAuditMetaKey(key)}
                    </dt>
                    <dd
                      className="font-medium sm:text-right break-all font-mono text-[11px] sm:text-xs"
                      style={{ color: 'var(--pd-text)' }}
                    >
                      {formatAuditMetaValue(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {log.userAgent ? (
            <p className="text-[11px] flex items-start gap-1.5" style={{ color: 'var(--pd-muted)' }}>
              <Monitor className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="break-all">{log.userAgent}</span>
            </p>
          ) : null}

          <p className="text-[10px] font-mono" style={{ color: 'var(--pd-muted)' }}>
            ID evento {log.id}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default function SystemAdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('logs')
  const { showToast, ToastContainer } = useToast()

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage] = useState(1)
  const [filterAction, setFilterAction] = useState<string | null>(null)

  const [backups, setBackups] = useState<AuditLog[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [creatingBackup, setCreatingBackup] = useState(false)

  const [showBackupConfirm, setShowBackupConfirm] = useState(false)
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false)

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs()
    if (activeTab === 'backups') fetchBackups()
  }, [activeTab, logsPage, filterAction])

  const fetchLogs = async () => {
    setLogsLoading(true)
    try {
      let url = `/api/admin/audit-logs?limit=${PAGE_SIZE}&offset=${(logsPage - 1) * PAGE_SIZE}`
      if (filterAction) url += `&action=${filterAction}`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs)
        setLogsTotal(data.total)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
      showToast('Errore nel caricamento dei log', 'error')
    } finally {
      setLogsLoading(false)
    }
  }

  const fetchBackups = async () => {
    setBackupsLoading(true)
    try {
      const response = await fetch('/api/admin/audit-logs?action=DATABASE_BACKUP&limit=50')
      if (response.ok) {
        const data = await response.json()
        setBackups(data.logs || [])
      }
    } catch (error) {
      console.error('Error fetching backups:', error)
    } finally {
      setBackupsLoading(false)
    }
  }

  const createBackup = async () => {
    setCreatingBackup(true)
    try {
      const response = await fetch('/api/admin/database/backup', { method: 'POST' })

      if (response.ok) {
        const data = await response.json()
        showToast(
          `Backup creato · ${Object.keys(data.tables || {}).length} tabelle`,
          'success'
        )
        fetchBackups()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore backup', 'error')
      }
    } catch (error) {
      console.error('Error creating backup:', error)
      showToast('Errore durante la creazione del backup', 'error')
    } finally {
      setCreatingBackup(false)
    }
  }

  const downloadBackup = () => {
    window.open('/api/admin/database/backup?download=true', '_blank')
  }

  const totalPages = Math.ceil(logsTotal / PAGE_SIZE)

  const filterOptions = useMemo(
    () =>
      Object.entries(AUDIT_ACTION_LABELS).sort((a, b) => a[1].localeCompare(b[1], 'it')),
    []
  )

  const tabs: { id: TabId; label: string; icon: typeof Activity }[] = [
    { id: 'logs', label: 'Audit log', icon: Activity },
    { id: 'backups', label: 'Backup', icon: Database },
  ]

  return (
    <MainLayout adminOnly contentWidth="6xl">
      <ToastContainer />
      <div className="pd-page pb-16">
        <PageHeader
          dense
          title="Sistema"
          subtitle="Audit log e backup database"
        />

        <div
          className="inline-flex p-1 gap-0.5 overflow-x-auto max-w-full"
          style={{
            background: 'var(--pd-surface-muted)',
            borderRadius: 'var(--pd-radius-pill)',
            border: '1px solid var(--pd-border)',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold pd-press whitespace-nowrap"
              style={{
                borderRadius: 'var(--pd-radius-pill)',
                background: activeTab === tab.id ? 'var(--pd-surface)' : 'transparent',
                color: activeTab === tab.id ? 'var(--pd-text)' : 'var(--pd-muted)',
                boxShadow: activeTab === tab.id ? 'var(--pd-shadow)' : undefined,
              }}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterAction || ''}
                onChange={(e) => {
                  setFilterAction(e.target.value || null)
                  setLogsPage(1)
                }}
                className="flex-1 min-w-[200px] px-3 py-2 text-sm border focus:outline-none focus:ring-2"
                style={{
                  borderColor: 'var(--pd-border)',
                  borderRadius: 'var(--pd-radius)',
                  background: 'var(--pd-surface)',
                  color: 'var(--pd-text)',
                }}
              >
                <option value="">Tutte le azioni</option>
                {filterOptions.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => fetchLogs()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"
                style={{
                  background: 'var(--pd-surface-muted)',
                  borderRadius: 'var(--pd-radius)',
                  color: 'var(--pd-muted)',
                }}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', logsLoading && 'animate-spin')} />
                Aggiorna
              </button>
              <span className="text-xs tabular-nums ml-auto" style={{ color: 'var(--pd-muted)' }}>
                {logsTotal.toLocaleString('it-IT')} eventi
              </span>
            </div>

            <SectionBlock
              title="Eventi"
              subtitle={
                filterAction
                  ? AUDIT_ACTION_LABELS[filterAction] || filterAction
                  : 'Tocca una riga per vedere i dettagli'
              }
              card
            >
              {logsLoading ? (
                <div className="py-12 flex justify-center">
                  <div
                    className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
                    style={{ borderColor: 'var(--pd-accent)', borderTopColor: 'transparent' }}
                  />
                </div>
              ) : logs.length === 0 ? (
                <EmptyState
                  title="Nessun log trovato"
                  description="Prova a cambiare filtro o attendi nuove attività."
                  icon={<Activity className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
                />
              ) : (
                <>
                  {logs.map((log) => (
                    <AuditLogRow key={log.id} log={log} />
                  ))}
                  {totalPages > 1 && (
                    <div
                      className="px-4 py-3 flex items-center justify-between gap-3"
                      style={{ background: 'var(--pd-surface-muted)' }}
                    >
                      <span className="text-xs" style={{ color: 'var(--pd-muted)' }}>
                        Pagina {logsPage} di {totalPages}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                          disabled={logsPage === 1}
                          className="px-3 py-1.5 text-xs font-medium border disabled:opacity-40"
                          style={{
                            borderColor: 'var(--pd-border)',
                            borderRadius: 'var(--pd-radius)',
                            background: 'var(--pd-surface)',
                            color: 'var(--pd-text)',
                          }}
                        >
                          Precedente
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogsPage((p) => Math.min(totalPages, p + 1))}
                          disabled={logsPage === totalPages}
                          className="px-3 py-1.5 text-xs font-medium border disabled:opacity-40"
                          style={{
                            borderColor: 'var(--pd-border)',
                            borderRadius: 'var(--pd-radius)',
                            background: 'var(--pd-surface)',
                            color: 'var(--pd-text)',
                          }}
                        >
                          Successiva
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </SectionBlock>
          </div>
        )}

        {activeTab === 'backups' && (
          <div className="space-y-4">
            <SectionBlock
              title="Backup database"
              subtitle="On-demand · cron automatico ogni giovedì alle 15:00"
              action={
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={downloadBackup}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border"
                    style={{
                      borderColor: 'var(--pd-border)',
                      borderRadius: 'var(--pd-radius)',
                      background: 'var(--pd-surface)',
                      color: 'var(--pd-success)',
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Scarica
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBackupConfirm(true)}
                    disabled={creatingBackup}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm pd-btn-primary disabled:opacity-50"
                  >
                    {creatingBackup ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4" />
                    )}
                    Crea snapshot
                  </button>
                </div>
              }
            >
              {null}
            </SectionBlock>

            <SectionBlock card>
              {backupsLoading ? (
                <EmptyState title="Ricerca backup…" />
              ) : backups.length === 0 ? (
                <EmptyState
                  title="Nessun backup in archivio"
                  description="Usa «Crea snapshot» per generarne uno on-demand."
                  icon={<Database className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
                />
              ) : (
                backups.map((backup) => {
                  const metadata = (backup.metadata || {}) as Record<string, any>
                  const timestamp = metadata?.timestamp || backup.createdAt
                  const tables = metadata?.tables || {}
                  const tableCount = Object.keys(tables).length
                  const totalRecords = Object.values(tables).reduce(
                    (sum: number, count: any) => sum + (count || 0),
                    0
                  )

                  return (
                    <ListRow
                      key={backup.id}
                      title={`backup_${String(timestamp).replace(/[-:]/g, '')}`}
                      subtitle={`${tableCount} tabelle · ${totalRecords.toLocaleString()} record · ${backup.userUsername}`}
                      meta={format(new Date(backup.createdAt), 'dd MMM yyyy · HH:mm', { locale: it })}
                      leading={
                        <HardDrive className="h-5 w-5" style={{ color: 'var(--pd-muted)' }} />
                      }
                      trailing={
                        <button
                          type="button"
                          onClick={() =>
                            window.open('/api/admin/database/backup?download=true', '_blank')
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                          style={{
                            background: 'var(--pd-accent-soft)',
                            color: 'var(--pd-accent)',
                            borderRadius: 'var(--pd-radius)',
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Scarica
                        </button>
                      }
                    />
                  )
                })
              )}
            </SectionBlock>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={showBackupConfirm}
        onClose={() => setShowBackupConfirm(false)}
        onConfirm={createBackup}
        title="Crea backup database"
        description="Stai per creare un backup completo del database. Il backup includerà tutte le tabelle e i dati."
        confirmPhrase="CREA BACKUP"
        confirmButtonText="Crea backup"
        isDangerous={false}
        metadata={
          <div className="text-sm space-y-1">
            <p>
              <strong>Database:</strong> PostgreSQL (Neon)
            </p>
            <p>
              <strong>Formato:</strong> JSON esportato via Prisma
            </p>
            <p>
              <strong>Include:</strong> Utenti, turni, ore, assenze, ecc.
            </p>
          </div>
        }
      />

      <ConfirmationModal
        isOpen={showCleanupConfirm}
        onClose={() => setShowCleanupConfirm(false)}
        onConfirm={() => {
          showToast('I backup sono on-demand: non ci sono file da eliminare.', 'info')
          setShowCleanupConfirm(false)
        }}
        title="Info pulizia backup"
        description="I backup sono generati on-demand e scaricati direttamente. Non vengono più salvati file sul server."
        confirmPhrase="OK"
        confirmButtonText="Capito"
        isDangerous={false}
        metadata={
          <div className="text-sm space-y-1">
            <p>
              <strong>Sistema:</strong> Backup on-demand
            </p>
            <p>
              <strong>Storico:</strong> Visibile nei log di audit
            </p>
          </div>
        }
      />
    </MainLayout>
  )
}
