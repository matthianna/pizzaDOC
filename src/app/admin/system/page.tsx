'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { SectionBlock } from '@/components/ui/section-block'
import { StatStrip } from '@/components/ui/stat-strip'
import { ListRow, EmptyState } from '@/components/ui/list-row'
import {
  Activity,
  Database,
  Download,
  Clock,
  RefreshCw,
  HardDrive,
  TrendingUp,
  Bell,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { cn } from '@/lib/utils'

interface AuditLog {
  id: string
  userId: string
  userUsername: string
  action: string
  description: string
  ipAddress: string | null
  userAgent: string | null
  metadata: any
  createdAt: string
  user: {
    id: string
    username: string
    primaryRole: string | null
  }
}

interface SystemStats {
  totalLogs: number
  logsToday: number
  logsThisWeek: number
  backupsCount: number
  lastBackup: string | null
  databaseSize: string
}

type TabId = 'logs' | 'backups' | 'stats' | 'tasks'

export default function SystemAdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('logs')

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage] = useState(1)
  const [filterAction, setFilterAction] = useState<string | null>(null)
  const [filterUser, setFilterUser] = useState<string | null>(null)

  const [backups, setBackups] = useState<AuditLog[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [creatingBackup, setCreatingBackup] = useState(false)

  const [stats, setStats] = useState<SystemStats | null>(null)

  const [showBackupConfirm, setShowBackupConfirm] = useState(false)
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false)

  const [tasks, setTasks] = useState<any[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [triggeringTask, setTriggeringTask] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs()
    if (activeTab === 'backups') fetchBackups()
    if (activeTab === 'stats') fetchStats()
    if (activeTab === 'tasks') fetchTasks()
  }, [activeTab, logsPage, filterAction, filterUser])

  const fetchLogs = async () => {
    setLogsLoading(true)
    try {
      let url = `/api/admin/audit-logs?limit=20&offset=${(logsPage - 1) * 20}`
      if (filterAction) url += `&action=${filterAction}`
      if (filterUser) url += `&userId=${filterUser}`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs)
        setLogsTotal(data.total)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
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

  const fetchTasks = async () => {
    setTasksLoading(true)
    try {
      const response = await fetch('/api/admin/system/tasks')
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks)
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setTasksLoading(false)
    }
  }

  const runTask = async (taskId: string) => {
    setTriggeringTask(taskId)
    try {
      const response = await fetch('/api/admin/system/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })

      const data = await response.json()
      if (response.ok) {
        alert(data.message)
      } else {
        alert(`Errore: ${data.error || 'Esecuzione fallita'}`)
      }
    } catch (error) {
      console.error('Error running task:', error)
      alert("Errore durante l'esecuzione dell'attività")
    } finally {
      setTriggeringTask(null)
    }
  }

  const fetchStats = async () => {
    setStats({
      totalLogs: logsTotal,
      logsToday: 12,
      logsThisWeek: 45,
      backupsCount: backups.length,
      lastBackup: backups[0]?.createdAt || null,
      databaseSize: '12.5 MB'
    })
  }

  const createBackup = async () => {
    setCreatingBackup(true)
    try {
      const response = await fetch('/api/admin/database/backup', { method: 'POST' })

      if (response.ok) {
        const data = await response.json()
        alert(
          `Backup creato con successo.\n\nTimestamp: ${data.timestamp}\nTabelle: ${Object.keys(data.tables || {}).length}`
        )
        fetchBackups()
      } else {
        const error = await response.json()
        alert(`Errore: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating backup:', error)
      alert('Errore durante la creazione del backup')
    } finally {
      setCreatingBackup(false)
    }
  }

  const downloadBackup = () => {
    window.open('/api/admin/database/backup?download=true', '_blank')
  }

  const actionLabels: Record<string, string> = {
    SCHEDULE_GENERATE: 'Piano generato',
    SCHEDULE_DELETE: 'Piano eliminato',
    SHIFT_ADD: 'Turno aggiunto',
    SHIFT_DELETE: 'Turno eliminato',
    SHIFT_EDIT: 'Turno modificato',
    HOURS_APPROVE: 'Ore approvate',
    HOURS_REJECT: 'Ore rifiutate',
    HOURS_EDIT: 'Ore modificate',
    USER_CREATE: 'Utente creato',
    USER_DELETE: 'Utente eliminato',
    DATABASE_BACKUP: 'Backup creato',
    ABSENCE_CREATE: 'Assenza creata',
    ABSENCE_EDIT: 'Assenza modificata',
    ABSENCE_DELETE: 'Assenza eliminata',
    ABSENCE_APPROVE: 'Assenza approvata',
    ABSENCE_REJECT: 'Assenza rifiutata',
    TASK_RUN: 'Task eseguito',
  }

  const totalPages = Math.ceil(logsTotal / 20)

  const tabs: { id: TabId; label: string; icon: typeof Activity }[] = [
    { id: 'logs', label: 'Audit log', icon: Activity },
    { id: 'backups', label: 'Backup', icon: Database },
    { id: 'stats', label: 'Statistiche', icon: TrendingUp },
    { id: 'tasks', label: 'Promemoria', icon: Bell },
  ]

  return (
    <MainLayout adminOnly contentWidth="6xl">
      <div className="pd-page">
        <PageHeader
          dense
          title="Sistema"
          subtitle="Audit log, backup database e attività programmate"
        />

        <div
          className="flex items-center gap-1 overflow-x-auto p-1"
          style={{
            background: 'var(--pd-surface-muted)',
            borderRadius: 'var(--pd-radius-lg)',
            border: '1px solid var(--pd-border)',
          }}
        >
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                activeTab === tab.id && 'shadow-sm'
              )}
              style={{
                borderRadius: 'var(--pd-radius)',
                background: activeTab === tab.id ? 'var(--pd-surface)' : 'transparent',
                color: activeTab === tab.id ? 'var(--pd-text)' : 'var(--pd-muted)',
              }}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <SectionBlock
              title="Filtri"
              action={
                <span className="text-sm tabular-nums" style={{ color: 'var(--pd-muted)' }}>
                  {logsTotal} eventi
                </span>
              }
              card
            >
              <div className="p-4 flex flex-wrap items-center gap-3">
                <select
                  value={filterAction || ''}
                  onChange={(e) => {
                    setFilterAction(e.target.value || null)
                    setLogsPage(1)
                  }}
                  className="flex-1 min-w-[200px] px-3 py-2.5 text-sm border focus:outline-none focus:ring-2"
                  style={{
                    borderColor: 'var(--pd-border)',
                    borderRadius: 'var(--pd-radius)',
                    background: 'var(--pd-surface-muted)',
                    color: 'var(--pd-text)',
                  }}
                >
                  <option value="">Tutte le azioni</option>
                  {Object.entries(actionLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setFilterAction(null)
                    setFilterUser(null)
                    setLogsPage(1)
                    fetchLogs()
                  }}
                  className="p-2.5 transition-opacity hover:opacity-80"
                  style={{
                    background: 'var(--pd-surface-muted)',
                    borderRadius: 'var(--pd-radius)',
                    color: 'var(--pd-muted)',
                  }}
                  title="Azzera filtri"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </SectionBlock>

            <SectionBlock card>
              {logsLoading ? (
                <EmptyState title="Caricamento log…" />
              ) : logs.length === 0 ? (
                <EmptyState
                  title="Nessun log trovato"
                  description="Prova a cambiare filtro o attendi nuove attività."
                  icon={<Activity className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
                />
              ) : (
                <>
                  {logs.map(log => (
                    <ListRow
                      key={log.id}
                      title={actionLabels[log.action] || log.action}
                      subtitle={log.description}
                      meta={format(new Date(log.createdAt), 'dd MMM yy · HH:mm', { locale: it })}
                      leading={
                        <div
                          className="w-8 h-8 flex items-center justify-center text-xs font-semibold"
                          style={{
                            background: 'var(--pd-accent-soft)',
                            color: 'var(--pd-accent)',
                            borderRadius: '999px',
                          }}
                        >
                          {log.userUsername.charAt(0).toUpperCase()}
                        </div>
                      }
                      trailing={
                        <span className="text-[11px] font-mono" style={{ color: 'var(--pd-muted)' }}>
                          {log.userUsername} · {log.ipAddress || '—'}
                        </span>
                      }
                    />
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
                          onClick={() => setLogsPage(p => Math.max(1, p - 1))}
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
                          onClick={() => setLogsPage(p => Math.min(totalPages, p + 1))}
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
              subtitle="On-demand; cron automatico ogni giovedì alle 15:00"
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
                backups.map(backup => {
                  const metadata = backup.metadata as any
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

        {activeTab === 'stats' && stats && (
          <div className="space-y-4">
            <StatStrip
              columns={4}
              items={[
                { label: 'Eventi totali', value: stats.totalLogs },
                { label: 'Eventi oggi', value: stats.logsToday },
                { label: 'Backup archiviati', value: stats.backupsCount },
                { label: 'Peso database', value: stats.databaseSize },
              ]}
            />

            <SectionBlock title="Salute del sistema" subtitle="Indicatori di carico (indicativi)" card>
              <div className="p-5 space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--pd-muted)' }}>Carico database</span>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--pd-text)' }}>
                      12%
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden"
                    style={{ background: 'var(--pd-surface-muted)', borderRadius: '999px' }}
                  >
                    <div
                      className="h-full w-[12%]"
                      style={{ background: 'var(--pd-success)', borderRadius: '999px' }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--pd-muted)' }}>Utilizzo storage backup</span>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--pd-text)' }}>
                      45%
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden"
                    style={{ background: 'var(--pd-surface-muted)', borderRadius: '999px' }}
                  >
                    <div
                      className="h-full w-[45%]"
                      style={{ background: 'var(--pd-accent)', borderRadius: '999px' }}
                    />
                  </div>
                </div>
                {stats.lastBackup && (
                  <p className="text-xs flex items-center gap-2" style={{ color: 'var(--pd-muted)' }}>
                    <Clock className="h-3.5 w-3.5" />
                    Ultimo backup:{' '}
                    {format(new Date(stats.lastBackup), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
                  </p>
                )}
              </div>
            </SectionBlock>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <SectionBlock
              title="Notifiche automatiche"
              subtitle="Attività programmate e avvii manuali"
              action={
                <button
                  type="button"
                  onClick={fetchTasks}
                  className="p-2.5 transition-opacity hover:opacity-80"
                  style={{
                    background: 'var(--pd-surface-muted)',
                    borderRadius: 'var(--pd-radius)',
                    color: 'var(--pd-muted)',
                  }}
                >
                  <RefreshCw className={cn('h-4 w-4', tasksLoading && 'animate-spin')} />
                </button>
              }
            >
              {null}
            </SectionBlock>

            <SectionBlock card>
              {tasksLoading && tasks.length === 0 ? (
                <EmptyState title="Caricamento attività…" />
              ) : tasks.length === 0 ? (
                <EmptyState
                  title="Nessuna attività programmata"
                  icon={<Bell className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
                />
              ) : (
                tasks.map((task: any) => (
                  <ListRow
                    key={task.id}
                    title={task.name}
                    subtitle={
                      task.readable
                        ? `${task.description} · ${task.readable}${
                            task.nextRun
                              ? ` · prossima: ${format(new Date(task.nextRun), 'dd MMM yyyy HH:mm', { locale: it })}`
                              : ''
                          }`
                        : task.description
                    }
                    meta={task.readable ? 'Programmato' : 'Manuale'}
                    leading={
                      task.id.includes('reminder') ? (
                        <Bell className="h-5 w-5" style={{ color: 'var(--pd-accent)' }} />
                      ) : (
                        <Clock className="h-5 w-5" style={{ color: 'var(--pd-muted)' }} />
                      )
                    }
                    trailing={
                      <button
                        type="button"
                        onClick={() => runTask(task.id)}
                        disabled={triggeringTask === task.id}
                        className="px-3 py-1.5 text-xs font-semibold pd-btn-primary disabled:opacity-50 whitespace-nowrap"
                      >
                        {triggeringTask === task.id ? 'Esecuzione…' : 'Esegui ora'}
                      </button>
                    }
                  />
                ))
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
            <p><strong>Database:</strong> PostgreSQL (Neon)</p>
            <p><strong>Formato:</strong> JSON esportato via Prisma</p>
            <p><strong>Include:</strong> Utenti, turni, ore, assenze, ecc.</p>
          </div>
        }
      />

      <ConfirmationModal
        isOpen={showCleanupConfirm}
        onClose={() => setShowCleanupConfirm(false)}
        onConfirm={() => {
          alert('I backup sono on-demand e scaricati direttamente. Non ci sono file da eliminare.')
          setShowCleanupConfirm(false)
        }}
        title="Info pulizia backup"
        description="I backup sono generati on-demand e scaricati direttamente. Non vengono più salvati file sul server."
        confirmPhrase="OK"
        confirmButtonText="Capito"
        isDangerous={false}
        metadata={
          <div className="text-sm space-y-1">
            <p><strong>Sistema:</strong> Backup on-demand</p>
            <p><strong>Storico:</strong> Visibile nei log di audit</p>
          </div>
        }
      />
    </MainLayout>
  )
}
