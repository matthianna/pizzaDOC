'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Clock, Check, X, AlertCircle } from 'lucide-react'
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

  const getShiftDate = (shift: Shift): Date => {
    const weekStart = new Date(shift.schedule.weekStart)
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Clock className="h-8 w-8 mr-3 text-orange-600" />
              Gestione Ore Lavorate
            </h1>
            <p className="text-gray-600 mt-1">
              Approva o rifiuta le ore lavorate inserite dai dipendenti
            </p>
          </div>
        </div>

        {/* Filters and Stats */}
        <div className="bg-white rounded-lg shadow p-6">
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
          ) : workedHours.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data e Turno
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Orario Turno
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Orario Lavorato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ore
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workedHours.map((hours) => {
                    const shiftDate = getShiftDate(hours.shift)
                    return (
                      <tr key={hours.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {hours.user.username}
                            </div>
                            <div className="text-sm text-gray-500">
                              {getRoleName(hours.user.primaryRole)}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {getDayName(hours.shift.dayOfWeek)} {formatDate(shiftDate)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {getShiftTypeName(hours.shift.shiftType)} - {getRoleName(hours.shift.role)}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {hours.shift.startTime} - {hours.shift.endTime}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {hours.startTime} - {hours.endTime}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {hours.totalHours.toFixed(1)}h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {hours.status === 'PENDING' && (
                            <div className="flex space-x-2">
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
                            </div>
                          )}
                          {hours.status !== 'PENDING' && hours.reviewedAt && (
                            <div className="text-xs text-gray-500">
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

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Rifiuta Ore Lavorate
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Motivo del rifiuto
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Specifica il motivo del rifiuto..."
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setRejectingId(null)
                      setRejectReason('')
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={() => rejectHours(rejectingId, rejectReason)}
                    disabled={!rejectReason.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    Rifiuta
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
