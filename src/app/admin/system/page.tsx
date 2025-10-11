'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { 
  Shield, Database, Activity, Download, Trash2, 
  AlertCircle, Clock, User, Filter, RefreshCw,
  HardDrive, Calendar, TrendingUp
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Select as ReactSelect } from '@/components/ui/react-select'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'

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
  const [activeTab, setActiveTab] = useState<'logs' | 'backups' | 'stats'>('logs')
  
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
        alert('✅ Backup creato con successo!')
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
  }

  const totalPages = Math.ceil(logsTotal / 20)

  return (
    <MainLayout adminOnly>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Shield className="h-6 w-6 text-orange-500 mr-2" />
            Sistema e Sicurezza
          </h1>
          <p className="text-gray-600 mt-1">
            Gestione audit log, backup database e monitoraggio sistema
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-6 py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'logs'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4" />
                  <span>Audit Log</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('backups')}
                className={`px-6 py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'backups'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Database className="h-4 w-4" />
                  <span>Backup</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-6 py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'stats'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Statistiche</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* AUDIT LOGS TAB */}
            {activeTab === 'logs' && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="flex items-center gap-4">
                  <div className="w-64">
                    <ReactSelect
                      label="Filtra per azione"
                      options={[
                        { value: null, label: 'Tutte le azioni' },
                        ...Object.entries(actionLabels).map(([key, label]) => ({
                          value: key,
                          label
                        }))
                      ]}
                      value={{
                        value: filterAction,
                        label: filterAction ? actionLabels[filterAction] : 'Tutte le azioni'
                      }}
                      onChange={(option) => {
                        setFilterAction(option?.value as string | null)
                        setLogsPage(1)
                      }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      setFilterAction(null)
                      setFilterUser(null)
                      setLogsPage(1)
                      fetchLogs()
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Reset Filtri</span>
                  </button>
                </div>

                {/* Logs Table */}
                {logsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Nessun log trovato</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data/Ora</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utente</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azione</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrizione</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {format(new Date(log.createdAt), 'dd/MM/yy HH:mm', { locale: it })}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {log.userUsername}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {actionLabels[log.action] || log.action}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 max-w-md truncate">
                                {log.description}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                                {log.ipAddress || 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-700">
                          Pagina <span className="font-medium">{logsPage}</span> di <span className="font-medium">{totalPages}</span>
                        </p>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                            disabled={logsPage === 1}
                            className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Precedente
                          </button>
                          <button
                            onClick={() => setLogsPage(p => Math.min(totalPages, p + 1))}
                            disabled={logsPage === totalPages}
                            className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Successiva
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* BACKUPS TAB */}
            {activeTab === 'backups' && (
              <div className="space-y-6">
                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Backup Database</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      I backup vengono creati automaticamente ogni giorno alle 2:00 AM
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowCleanupConfirm(true)}
                      className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-lg hover:bg-red-200 transition-colors flex items-center space-x-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Pulisci Vecchi</span>
                    </button>
                    <button
                      onClick={() => setShowBackupConfirm(true)}
                      disabled={creatingBackup}
                      className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {creatingBackup ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Creazione...</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          <span>Crea Backup Manuale</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Backups List */}
                {backupsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                  </div>
                ) : backups.length === 0 ? (
                  <div className="text-center py-12">
                    <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Nessun backup disponibile</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {backups.map((backup) => (
                      <div key={backup.filename} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                              <HardDrive className="h-6 w-6 text-orange-600" />
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">{backup.filename}</h4>
                              <div className="flex items-center space-x-4 mt-1">
                                <div className="flex items-center text-xs text-gray-500">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {format(new Date(backup.createdAt), 'dd MMM yyyy HH:mm', { locale: it })}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {backup.sizeReadable}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Disponibile
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STATS TAB */}
            {activeTab === 'stats' && stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">Audit Log Totali</p>
                      <p className="text-3xl font-bold text-blue-900 mt-2">{stats.totalLogs}</p>
                    </div>
                    <Activity className="h-12 w-12 text-blue-300" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">Log Oggi</p>
                      <p className="text-3xl font-bold text-green-900 mt-2">{stats.logsToday}</p>
                    </div>
                    <Clock className="h-12 w-12 text-green-300" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">Log Settimana</p>
                      <p className="text-3xl font-bold text-purple-900 mt-2">{stats.logsThisWeek}</p>
                    </div>
                    <TrendingUp className="h-12 w-12 text-purple-300" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600">Backup Disponibili</p>
                      <p className="text-3xl font-bold text-orange-900 mt-2">{stats.backupsCount}</p>
                    </div>
                    <Database className="h-12 w-12 text-orange-300" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Dimensione DB</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stats.databaseSize}</p>
                    </div>
                    <HardDrive className="h-12 w-12 text-gray-300" />
                  </div>
                </div>

                {stats.lastBackup && (
                  <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 border border-cyan-200 rounded-lg p-6">
                    <div>
                      <p className="text-sm font-medium text-cyan-600">Ultimo Backup</p>
                      <p className="text-lg font-bold text-cyan-900 mt-2">
                        {format(new Date(stats.lastBackup), 'dd MMM yyyy', { locale: it })}
                      </p>
                      <p className="text-xs text-cyan-700 mt-1">
                        {format(new Date(stats.lastBackup), 'HH:mm', { locale: it })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backup Confirmation Modal */}
      <ConfirmationModal
        isOpen={showBackupConfirm}
        onClose={() => setShowBackupConfirm(false)}
        onConfirm={createBackup}
        title="Crea Backup Database"
        description="Stai per creare un backup manuale del database. L'operazione potrebbe richiedere alcuni secondi."
        confirmPhrase="CREA BACKUP"
        confirmButtonText="Crea Backup"
        isDangerous={false}
        metadata={
          <div className="text-sm space-y-1">
            <p><strong>Database:</strong> PostgreSQL (Neon)</p>
            <p><strong>Formato:</strong> SQL dump completo</p>
            <p><strong>Storage:</strong> /backups directory</p>
          </div>
        }
      />

      {/* Cleanup Confirmation Modal */}
      <ConfirmationModal
        isOpen={showCleanupConfirm}
        onClose={() => setShowCleanupConfirm(false)}
        onConfirm={cleanupOldBackups}
        title="Pulisci Backup Vecchi"
        description="Stai per eliminare tutti i backup più vecchi di 30 giorni. Questa azione è irreversibile."
        confirmPhrase="ELIMINA VECCHI"
        confirmButtonText="Elimina Backup Vecchi"
        isDangerous={true}
        metadata={
          <div className="text-sm space-y-1">
            <p><strong>Retention:</strong> 30 giorni</p>
            <p><strong>Backup totali:</strong> {backups.length}</p>
          </div>
        }
      />
    </MainLayout>
  )
}

