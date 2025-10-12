'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Clock, Check, X, AlertCircle, Edit2 } from 'lucide-react'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'
import { Role, ShiftType, HoursStatus } from '@prisma/client'
import { Select as ReactSelect } from '@/components/ui/react-select'

interface Shift {
  id: string
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  startTime: string
  endTime: string
  schedule: {
    weekStart: string
  }
}

interface WorkedHours {
  id: string
  shiftId: string
  startTime: string
  endTime: string
  totalHours: number
  status: HoursStatus
  rejectionReason?: string
  submittedAt: string
  reviewedAt?: string
  user: {
    id: string
    username: string
    primaryRole: Role
  }
  shift: Shift
}

export default function AdminHoursPage() {
  const [workedHours, setWorkedHours] = useState<WorkedHours[]>([])
  const [filterStatus, setFilterStatus] = useState<HoursStatus | 'ALL'>('PENDING')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [editingHours, setEditingHours] = useState<WorkedHours | null>(null)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')

  useEffect(() => {
    fetchWorkedHours()
  }, [filterStatus, selectedMonth, selectedYear])

  const fetchWorkedHours = async () => {
    setLoading(true)
    try {
      let url = `/api/admin/hours?month=${selectedMonth}&year=${selectedYear}`
      if (filterStatus !== 'ALL') {
        url += `&status=${filterStatus}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setWorkedHours(data)
      }
    } catch (error) {
      console.error('Error fetching worked hours:', error)
    } finally {
      setLoading(false)
    }
  }

  const approveHours = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/hours/${id}/approve`, {
        method: 'POST'
      })

      if (response.ok) {
        fetchWorkedHours()
        alert('Ore approvate con successo')
      } else {
        alert('Errore durante l\'approvazione')
      }
    } catch (error) {
      console.error('Error approving hours:', error)
      alert('Errore durante l\'approvazione')
    }
  }

  const rejectHours = async (id: string, reason: string) => {
    try {
      const response = await fetch(`/api/admin/hours/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      })

      if (response.ok) {
        setRejectingId(null)
        setRejectReason('')
        fetchWorkedHours()
        alert('Ore rifiutate con successo')
      } else {
        alert('Errore durante il rifiuto')
      }
    } catch (error) {
      console.error('Error rejecting hours:', error)
      alert('Errore durante il rifiuto')
    }
  }

  const openEditModal = (hours: WorkedHours) => {
    setEditingHours(hours)
    setEditStartTime(hours.startTime)
    setEditEndTime(hours.endTime)
  }

  const closeEditModal = () => {
    setEditingHours(null)
    setEditStartTime('')
    setEditEndTime('')
  }

  const saveEditedHours = async () => {
    if (!editingHours) return

    try {
      const response = await fetch(`/api/admin/hours/${editingHours.id}/edit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startTime: editStartTime,
          endTime: editEndTime
        })
      })

      if (response.ok) {
        closeEditModal()
        fetchWorkedHours()
        alert('Ore modificate con successo')
      } else {
        const error = await response.json()
        alert(error.error || 'Errore durante la modifica')
      }
    } catch (error) {
      console.error('Error editing hours:', error)
      alert('Errore durante la modifica')
    }
  }

  const calculateTotalHours = (start: string, end: string): number => {
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)
    
    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60
    }
    
    return totalMinutes / 60
  }

  const getShiftDate = (shift: Shift): Date => {
    const weekStart = new Date(shift.schedules.weekStart)
    const shiftDate = new Date(weekStart)
    shiftDate.setDate(shiftDate.getDate() + shift.dayOfWeek)
    return shiftDate
  }

  const getStatusColor = (status: HoursStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: HoursStatus) => {
    switch (status) {
      case 'PENDING':
        return 'In attesa'
      case 'APPROVED':
        return 'Approvate'
      case 'REJECTED':
        return 'Rifiutate'
      default:
        return status
    }
  }

  const totalHours = workedHours.reduce((sum, h) => sum + h.totalHours, 0)
  const pendingCount = workedHours.filter(h => h.status === 'PENDING').length

  return (
    <MainLayout adminOnly>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
              <Clock className="h-6 w-6 sm:h-8 sm:w-8 mr-3 text-orange-600" />
              Gestione Ore Lavorate
            </h1>
            <p className="text-gray-600 mt-1">
              Approva o rifiuta le ore lavorate inserite dai dipendenti
            </p>
          </div>
        </div>

        {/* Filters and Stats */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-40">
                <ReactSelect
                  label="Stato"
                  options={[
                    { value: 'ALL', label: 'Tutti' },
                    { value: 'PENDING', label: 'In attesa' },
                    { value: 'APPROVED', label: 'Approvate' },
                    { value: 'REJECTED', label: 'Rifiutate' }
                  ]}
                  value={{ value: filterStatus, label: filterStatus === 'ALL' ? 'Tutti' : filterStatus === 'PENDING' ? 'In attesa' : filterStatus === 'APPROVED' ? 'Approvate' : 'Rifiutate' }}
                  onChange={(option) => setFilterStatus(option?.value as HoursStatus | 'ALL' || 'ALL')}
                />
              </div>
              <div className="w-32">
                <ReactSelect
                  label="Mese"
                  options={Array.from({ length: 12 }, (_, i) => ({
                    value: i + 1,
                    label: new Date(2024, i).toLocaleDateString('it-IT', { month: 'long' })
                  }))}
                  value={{ value: selectedMonth, label: new Date(2024, selectedMonth - 1).toLocaleDateString('it-IT', { month: 'long' }) }}
                  onChange={(option) => setSelectedMonth(option?.value as number || 1)}
                />
              </div>
              <div className="w-24">
                <ReactSelect
                  label="Anno"
                  options={[2024, 2025, 2026].map(year => ({
                    value: year,
                    label: year.toString()
                  }))}
                  value={{ value: selectedYear, label: selectedYear.toString() }}
                  onChange={(option) => setSelectedYear(option?.value as number || 2024)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-sm text-gray-500">In attesa</div>
                <div className="text-xl font-bold text-yellow-600">{pendingCount}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500">Ore totali</div>
                <div className="text-xl font-bold text-gray-900">{totalHours.toFixed(1)}h</div>
              </div>
            </div>
          </div>
        </div>

        {/* Worked Hours Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-orange-600"></div>
            </div>
          ) : workedHours.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm sm:text-base">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utente
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data e Turno
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Orario Turno
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Orario Lavorato
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ore
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stato
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workedHours.map((hours) => {
                    const shiftDate = getShiftDate(hours.shift)
                    return (
                      <tr key={hours.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {hours.user.username}
                            </div>
                            <div className="text-sm text-gray-500">
                              {getRoleName(hours.user.primaryRole)}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {getDayName(hours.shift.dayOfWeek)} {formatDate(shiftDate)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {getShiftTypeName(hours.shift.shiftType)} - {getRoleName(hours.shift.role)}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {hours.shift.startTime} - {hours.shift.endTime}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {hours.startTime} - {hours.endTime}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {hours.totalHours.toFixed(1)}h
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(hours.status)}`}>
                            {getStatusText(hours.status)}
                          </span>
                          {hours.status === 'REJECTED' && hours.rejectionReason && (
                            <div className="mt-1 text-xs text-red-600" title={hours.rejectionReason}>
                              <AlertCircle className="h-3 w-3 inline mr-1" />
                              {hours.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => openEditModal(hours)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Modifica ore"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            {hours.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => approveHours(hours.id)}
                                  className="text-green-600 hover:text-green-900"
                                  title="Approva"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setRejectingId(hours.id)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Rifiuta"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                          {hours.status !== 'PENDING' && hours.reviewedAt && (
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(hours.reviewedAt).toLocaleDateString('it-IT')}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nessuna ora trovata per i filtri selezionati</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Hours Modal */}
      {editingHours && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 max-w-2xl w-full transform transition-all">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-6 py-4 border-b border-blue-100 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Edit2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Modifica Ore Lavorate
                    </h2>
                    <p className="text-sm text-blue-600">
                      {editingHours.user.username} - {getDayName(editingHours.shift.dayOfWeek)} {getShiftTypeName(editingHours.shift.shiftType)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeEditModal}
                  className="w-8 h-8 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4 text-blue-600" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 sm:space-y-6">
              {/* Info turno */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 mb-1">Orario Turno</p>
                    <p className="font-medium text-gray-900">{editingHours.shift.startTime} - {editingHours.shift.endTime}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Ruolo</p>
                    <p className="font-medium text-gray-900">{getRoleName(editingHours.shift.role)}</p>
                  </div>
                </div>
              </div>

              {/* Edit times */}
              <div className="grid grid-cols-2 gap-4 sm:p-6">
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-800">
                    Ora Inizio * <span className="text-xs text-gray-500">(formato 24h)</span>
                  </label>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    step="60"
                    pattern="[0-9]{2}:[0-9]{2}"
                    placeholder="18:00"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors [&::-webkit-datetime-edit-ampm-field]:hidden"
                    style={{ colorScheme: 'light' }}
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-800">
                    Ora Fine * <span className="text-xs text-gray-500">(formato 24h)</span>
                  </label>
                  <input
                    type="time"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    step="60"
                    pattern="[0-9]{2}:[0-9]{2}"
                    placeholder="22:00"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors [&::-webkit-datetime-edit-ampm-field]:hidden"
                    style={{ colorScheme: 'light' }}
                  />
                </div>
              </div>

              {/* Calculated hours */}
              {editStartTime && editEndTime && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium mb-1">Ore Totali Calcolate</p>
                      <p className="text-xs text-blue-500">
                        {editStartTime} - {editEndTime}
                      </p>
                    </div>
                    <div className="text-3xl font-bold text-blue-600">
                      {calculateTotalHours(editStartTime, editEndTime).toFixed(1)}h
                    </div>
                  </div>
                </div>
              )}

              {/* Info alert */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Attenzione</p>
                    <p className="text-amber-700">
                      La modifica delle ore verrà salvata immediatamente. Le ore totali saranno ricalcolate automaticamente.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-xl">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeEditModal}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
                >
                  Annulla
                </button>
                <button
                  onClick={saveEditedHours}
                  disabled={!editStartTime || !editEndTime}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center space-x-2"
                >
                  <Check className="h-4 w-4" />
                  <span>Salva Modifiche</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 max-w-lg w-full transform transition-all">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-b border-red-100 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <X className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Rifiuta Ore Lavorate
                    </h2>
                    <p className="text-sm text-red-600">
                      Specifica il motivo del rifiuto
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setRejectingId(null)
                    setRejectReason('')
                  }}
                  className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Attenzione</p>
                    <p className="text-amber-700">
                      Il rifiuto comporterà la restituzione delle ore al dipendente per la correzione.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-800">
                  Motivo del rifiuto *
                </label>
                <div className="relative">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors resize-none"
                    placeholder="Esempio: Orario di fine non corretto, mancano informazioni sulla pausa, ecc..."
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                    {rejectReason.length}/500
                  </div>
                </div>
                <p className="text-xs text-gray-600">
                  Fornisci dettagli specifici per aiutare il dipendente a correggere l&apos;errore.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-xl">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setRejectingId(null)
                    setRejectReason('')
                  }}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
                >
                  Annulla
                </button>
                <button
                  onClick={() => rejectHours(rejectingId, rejectReason)}
                  disabled={!rejectReason.trim()}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center space-x-2"
                >
                  <X className="h-4 w-4" />
                  <span>Rifiuta Ore</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
