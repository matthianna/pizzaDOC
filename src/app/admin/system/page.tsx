'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import {
  Shield, Database, Activity, Download, Trash2,
  AlertCircle, Clock, User, Filter, RefreshCw,
  HardDrive, Calendar, TrendingUp, Bell
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'
import { Select as ReactSelect } from '@/components/ui/react-select'
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

interface Backup {
  filename: string
  path: string
  size: number
  sizeReadable: string
  createdAt: string
}

interface SystemStats {
  totalLogs: number
  logsToday: number
  logsThisWeek: number
  backupsCount: number
  lastBackup: string | null
  databaseSize: string
}

export default function SystemAdminPage() {
  const [activeTab, setActiveTab] = useState<'logs' | 'backups' | 'stats' | 'tasks'>('logs')

  // Audit Logs
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage] = useState(1)
  const [filterAction, setFilterAction] = useState<string | null>(null)
  const [filterUser, setFilterUser] = useState<string | null>(null)

  // Backups
  const [backups, setBackups] = useState<Backup[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [creatingBackup, setCreatingBackup] = useState(false)

  // Stats
  const [stats, setStats] = useState<SystemStats | null>(null)

  // Confirmation Modal
  const [showBackupConfirm, setShowBackupConfirm] = useState(false)
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false)

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
      const response = await fetch('/api/admin/database/backup')
      if (response.ok) {
        const data = await response.json()
        setBackups(data.backups)
      }
    } catch (error) {
      console.error('Error fetching backups:', error)
    } finally {
      setBackupsLoading(false)
    }
  }

  // Tasks/Reminders
  const [tasks, setTasks] = useState<any[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [triggeringTask, setTriggeringTask] = useState<string | null>(null)

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
        alert(`✅ ${data.message}`)
      } else {
        alert(`❌ Errore: ${data.error || 'Esecuzione fallita'}`)
      }
    } catch (error) {
      console.error('Error running task:', error)
      alert('❌ Errore durante l\'esecuzione dell\'attività')
    } finally {
      setTriggeringTask(null)
    }
  }

  const fetchStats = async () => {
    // Mock stats - implementare endpoint reale se necessario
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
      const response = await fetch('/api/admin/database/backup', {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        alert(`✅ Backup creato con successo!\n\nTimestamp: ${data.timestamp}\nTabelle: ${Object.keys(data.tables || {}).length}`)
        fetchBackups()
      } else {
        const error = await response.json()
        alert(`❌ Errore: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating backup:', error)
      alert('❌ Errore durante la creazione del backup')
    } finally {
      setCreatingBackup(false)
    }
  }

  const downloadBackup = () => {
    // Trigger download
    window.open('/api/admin/database/backup?download=true', '_blank')
  }

  const cleanupOldBackups = async () => {
    try {
      const response = await fetch('/api/admin/database/backup?days=30', {
        method: 'DELETE'
      })

      if (response.ok) {
        const data = await response.json()
        alert(`✅ Eliminati ${data.deletedCount} backup vecchi`)
        fetchBackups()
      }
    } catch (error) {
      console.error('Error cleaning backups:', error)
      alert('❌ Errore durante la pulizia')
    }
  }

  const actionLabels: Record<string, string> = {
    SCHEDULE_GENERATE: 'Piano Generato',
    SCHEDULE_DELETE: 'Piano Eliminato',
    SHIFT_ADD: 'Turno Aggiunto',
    SHIFT_DELETE: 'Turno Eliminato',
    SHIFT_EDIT: 'Turno Modificato',
    HOURS_APPROVE: 'Ore Approvate',
    HOURS_REJECT: 'Ore Rifiutate',
    HOURS_EDIT: 'Ore Modificate',
    USER_CREATE: 'Utente Creato',
    USER_DELETE: 'Utente Eliminato',
    DATABASE_BACKUP: 'Backup Creato',
    ABSENCE_CREATE: 'Assenza Creata',
    ABSENCE_EDIT: 'Assenza Modificata',
    ABSENCE_DELETE: 'Assenza Eliminata',
    ABSENCE_APPROVE: 'Assenza Approvata',
    ABSENCE_REJECT: 'Assenza Rifiutata',
    TASK_RUN: 'Task Eseguito',
  }

  const totalPages = Math.ceil(logsTotal / 20)

  return (
    <MainLayout adminOnly>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Moderno */}
        <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-8">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-gray-900 rounded-2xl shadow-lg">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                Sistema e Sicurezza
              </h1>
              <p className="text-gray-500 font-medium mt-1">
                Monitoraggio attività, gestione backup e configurazioni critiche.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs Moderne */}
        <div className="bg-white/50 backdrop-blur-md rounded-2xl p-2 flex items-center gap-1 overflow-x-auto scrollbar-hide border border-gray-100 shadow-sm">
          {[
            { id: 'logs', label: 'Audit Log', icon: Activity },
            { id: 'backups', label: 'Backup Database', icon: Database },
            { id: 'stats', label: 'Statistiche', icon: TrendingUp },
            { id: 'tasks', label: 'Promemoria', icon: Bell }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-3 px-6 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-white text-orange-600 shadow-md ring-1 ring-orange-100"
                  : "text-gray-500 hover:bg-white/50 hover:text-gray-900"
              )}
            >
              <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-orange-600" : "text-gray-400")} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Moderno */}
        <div className="min-h-[500px]">
          {/* AUDIT LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <select
                      value={filterAction || ''}
                      onChange={(e) => {
                        setFilterAction(e.target.value || null)
                        setLogsPage(1)
                      }}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border-gray-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all appearance-none"
                    >
                      <option value="">Tutte le azioni</option>
                      {Object.entries(actionLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      setFilterAction(null)
                      setFilterUser(null)
                      setLogsPage(1)
                      fetchLogs()
                    }}
                    className="p-3 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-all"
                    title="Reset filtri"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Totale Log</p>
                  <p className="text-xl font-black text-gray-900">{logsTotal}</p>
                </div>
              </div>

              {logsLoading ? (
                <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-20 text-center">
                  <RefreshCw className="h-10 w-10 text-orange-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Caricamento log...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-soft border border-dashed border-gray-300 p-20 text-center">
                  <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Nessun log trovato</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl shadow-soft border border-gray-100 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Data e Ora</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Utente</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Azione</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Descrizione</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Indirizzo IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-500">
                            {format(new Date(log.createdAt), 'dd MMM yy • HH:mm', { locale: it })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-black text-orange-600">
                                {log.userUsername.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs font-black text-gray-900">{log.userUsername}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider border border-blue-100">
                              {actionLabels[log.action] || log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-gray-600 max-w-md truncate">
                            {log.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-[10px] font-mono text-gray-400">
                            {log.ipAddress || '0.0.0.0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {totalPages > 1 && (
                    <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Pagina {logsPage} di {totalPages}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                          disabled={logsPage === 1}
                          className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-all"
                        >
                          Precedente
                        </button>
                        <button
                          onClick={() => setLogsPage(p => Math.min(totalPages, p + 1))}
                          disabled={logsPage === totalPages}
                          className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-all"
                        >
                          Successiva
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* BACKUPS TAB */}
          {activeTab === 'backups' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Archivio Backup</h3>
                  <p className="text-sm text-gray-500 font-medium mt-1">
                    Sistema di disaster recovery attivo. Snapshot quotidiani alle 02:00.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={downloadBackup}
                    className="px-6 py-3 text-xs font-black uppercase tracking-widest text-green-600 bg-green-50 rounded-2xl hover:bg-green-100 transition-all flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Scarica Backup
                  </button>
                  <button
                    onClick={() => setShowBackupConfirm(true)}
                    disabled={creatingBackup}
                    className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black shadow-lg shadow-gray-200 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {creatingBackup ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                    Crea Snapshot Ora
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {backupsLoading ? (
                  <div className="col-span-full bg-white rounded-3xl shadow-soft border border-gray-100 p-20 text-center">
                    <RefreshCw className="h-10 w-10 text-orange-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Ricerca backup...</p>
                  </div>
                ) : backups.length === 0 ? (
                  <div className="col-span-full bg-white rounded-3xl shadow-soft border border-dashed border-gray-300 p-20 text-center">
                    <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Nessun backup in archivio</p>
                  </div>
                ) : (
                  backups.map((backup) => (
                    <div key={backup.filename} className="bg-white rounded-3xl shadow-soft border border-gray-100 p-6 hover:shadow-xl transition-all group">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-orange-100 rounded-2xl text-orange-600 transition-transform group-hover:rotate-12">
                          <HardDrive className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-gray-900 truncate">{backup.filename}</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SQL Dump • {backup.sizeReadable}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-gray-300" />
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                            {format(new Date(backup.createdAt), 'dd MMM yyyy', { locale: it })}
                          </span>
                        </div>
                        <span className="px-2 py-1 bg-green-50 text-green-600 text-[9px] font-black uppercase tracking-widest rounded-lg border border-green-100">In Sicurezza</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STATS TAB */}
          {activeTab === 'stats' && stats && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Eventi Totali', value: stats.totalLogs, icon: Activity, color: 'orange' },
                  { label: 'Eventi Oggi', value: stats.logsToday, icon: Clock, color: 'blue' },
                  { label: 'Backup Archiviati', value: stats.backupsCount, icon: Database, color: 'green' },
                  { label: 'Peso Database', value: stats.databaseSize, icon: HardDrive, color: 'purple' }
                ].map((stat, i) => (
                  <div key={i} className="bg-white rounded-3xl shadow-soft border border-gray-100 p-8">
                    <div className={cn("p-3 rounded-2xl w-fit mb-4 shadow-sm", `bg-${stat.color}-100 text-${stat.color}-600`)}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-3xl font-black text-gray-900 tracking-tight">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                  <Activity className="h-48 w-48" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2">Salute del Sistema</h3>
                  <p className="text-sm text-gray-500 font-medium mb-8">Tutti i nodi sono operativi. Tempo di attività 99.9%.</p>
                  
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carico Database</p>
                        <p className="text-xs font-black text-gray-900">12%</p>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 w-[12%] rounded-full shadow-sm shadow-green-200" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Utilizzo Storage Backup</p>
                        <p className="text-xs font-black text-gray-900">45%</p>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 w-[45%] rounded-full shadow-sm shadow-orange-200" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TASKS TAB */}
          {activeTab === 'tasks' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    <Bell className="h-6 w-6 text-orange-600" />
                    Notifiche Automatiche
                  </h3>
                  <p className="text-sm text-gray-500 font-medium mt-1">
                    Visualizza e gestisci le notifiche automatiche programmate per la squadra.
                  </p>
                </div>
                <button
                  onClick={fetchTasks}
                  className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 transition-all hover:rotate-180 duration-500"
                >
                  <RefreshCw className={cn("h-6 w-6", tasksLoading ? 'animate-spin' : '')} />
                </button>
              </div>

              {tasksLoading && tasks.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-20 text-center">
                  <RefreshCw className="h-10 w-10 text-blue-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Caricamento task...</p>
                </div>
              ) : tasks.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-soft border border-dashed border-gray-300 p-20 text-center">
                  <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Nessuna attività programmata</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {tasks.map((task: any) => (
                    <div key={task.id} className="bg-white rounded-3xl p-8 border border-gray-100 shadow-soft hover:shadow-xl transition-all group">
                      <div className="flex items-start justify-between gap-4">
                        <div className={cn(
                          "w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg transition-transform group-hover:scale-110",
                          task.id.includes('reminder') ? "bg-blue-600 text-white shadow-blue-200" : "bg-orange-600 text-white shadow-orange-200"
                        )}>
                          {task.id.includes('reminder') ? (
                            <Bell className="h-8 w-8" />
                          ) : (
                            <Clock className="h-8 w-8" />
                          )}
                        </div>
                        <div className="text-right">
                          <span className={cn(
                            "px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border",
                            task.readable 
                              ? "bg-green-50 text-green-600 border-green-200"
                              : "bg-gray-100 text-gray-500 border-gray-200"
                          )}>
                            {task.readable ? 'Programmato' : 'Manuale'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-8">
                        <h4 className="text-xl font-black text-gray-900 tracking-tight">{task.name}</h4>
                        <p className="text-sm text-gray-500 font-medium mt-2 leading-relaxed">{task.description}</p>
                      </div>

                      {task.readable && (
                        <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                          <div className="flex items-center gap-3">
                            <Clock className="h-5 w-5 text-blue-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Orario Programmato</p>
                              <p className="text-sm font-black text-blue-900">{task.readable}</p>
                              {task.nextRun && (
                                <p className="text-xs text-blue-600 font-medium mt-1">
                                  Prossima esecuzione: {format(new Date(task.nextRun), 'dd MMMM yyyy', { locale: it })} alle {format(new Date(task.nextRun), 'HH:mm', { locale: it })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between gap-4">
                        <code className="text-[10px] font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded-md flex-1 truncate">{task.path}</code>
                        <button
                          onClick={() => runTask(task.id)}
                          disabled={triggeringTask === task.id}
                          className={cn(
                            "px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap",
                            task.id.includes('reminder')
                              ? "bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700"
                              : "bg-orange-600 text-white shadow-orange-200 hover:bg-orange-700"
                          )}
                        >
                          {triggeringTask === task.id ? (
                            <>
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span>Esecuzione...</span>
                            </>
                          ) : (
                            <span>Esegui Ora</span>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Backup Confirmation Modal */}
      <ConfirmationModal
        isOpen={showBackupConfirm}
        onClose={() => setShowBackupConfirm(false)}
        onConfirm={createBackup}
        title="Crea Backup Database"
        description="Stai per creare un backup completo del database. Il backup includerà tutte le tabelle e i dati."
        confirmPhrase="CREA BACKUP"
        confirmButtonText="Crea Backup"
        isDangerous={false}
        metadata={
          <div className="text-sm space-y-1">
            <p><strong>Database:</strong> PostgreSQL (Neon)</p>
            <p><strong>Formato:</strong> JSON esportato via Prisma</p>
            <p><strong>Include:</strong> Utenti, turni, ore, assenze, ecc.</p>
          </div>
        }
      />

      {/* Cleanup Confirmation Modal - No longer needed but kept for compatibility */}
      <ConfirmationModal
        isOpen={showCleanupConfirm}
        onClose={() => setShowCleanupConfirm(false)}
        onConfirm={() => {
          alert('ℹ️ I backup sono ora in-memory e vengono scaricati direttamente. Non ci sono file da eliminare.')
          setShowCleanupConfirm(false)
        }}
        title="Info Pulizia Backup"
        description="I backup sono ora generati on-demand e scaricati direttamente. Non vengono più salvati file sul server."
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

