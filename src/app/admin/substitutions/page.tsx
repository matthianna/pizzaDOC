'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Users, Check, X, Clock, AlertCircle, CheckCircle, XCircle, User } from 'lucide-react'
import { format, parseISO, addDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { Role, ShiftType, SubstitutionStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select as ReactSelect } from '@/components/ui/react-select'
import { useToast } from '@/components/ui/toast'

interface Shift {
  id: string
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  startTime: string
  endTime: string
  schedules: {
    weekStart: string
  }
}

interface User {
  id: string
  username: string
  primaryRole?: Role
}

interface Substitution {
  id: string
  shiftId: string
  requesterId: string
  substituteId?: string
  status: SubstitutionStatus
  requestNote?: string
  responseNote?: string
  deadline: string
  createdAt: string
  shifts: Shift
  requester: User
  substitute?: User
}

export default function AdminSubstitutionsPage() {
  const [substitutions, setSubstitutions] = useState<Substitution[]>([])
  const [filterStatus, setFilterStatus] = useState<SubstitutionStatus | 'ALL'>('APPLIED')
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedSubstitution, setSelectedSubstitution] = useState<Substitution | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    fetchSubstitutions()
  }, [filterStatus])

  const fetchSubstitutions = async () => {
    setLoading(true)
    try {
      let url = '/api/admin/substitutions'
      if (filterStatus !== 'ALL') {
        url += `?status=${filterStatus}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setSubstitutions(data)
      }
    } catch (error) {
      console.error('Error fetching substitutions:', error)
      showToast('Errore nel caricamento', 'error')
    } finally {
      setLoading(false)
    }
  }

  const approveSubstitution = async (substitutionId: string) => {
    setProcessingId(substitutionId)
    try {
      const response = await fetch(`/api/admin/substitutions/${substitutionId}/approve`, {
        method: 'POST',
      })

      if (response.ok) {
        showToast('Sostituzione approvata!', 'success')
        fetchSubstitutions()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nell\'approvazione', 'error')
      }
    } catch (error) {
      console.error('Error approving substitution:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const rejectSubstitution = async () => {
    if (!selectedSubstitution) return

    setProcessingId(selectedSubstitution.id)
    try {
      const response = await fetch(`/api/admin/substitutions/${selectedSubstitution.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          responseNote: rejectReason.trim() || null
        }),
      })

      if (response.ok) {
        showToast('Sostituzione rifiutata', 'success')
        setShowRejectModal(false)
        setSelectedSubstitution(null)
        setRejectReason('')
        fetchSubstitutions()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nel rifiuto', 'error')
      }
    } catch (error) {
      console.error('Error rejecting substitution:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const getShiftDate = (shift: Shift) => {
    const weekStart = new Date(shift.schedules.weekStart)
    // dayOfWeek è già nel formato corretto: 0=Lunedì, 1=Martedì, ..., 6=Domenica
    return addDays(weekStart, shift.dayOfWeek)
  }

  const getStatusIcon = (status: SubstitutionStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'APPLIED':
        return <User className="h-4 w-4 text-blue-500" />
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'EXPIRED':
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = (status: SubstitutionStatus) => {
    switch (status) {
      case 'PENDING':
        return 'In attesa candidati'
      case 'APPLIED':
        return 'Da approvare'
      case 'APPROVED':
        return 'Approvata'
      case 'REJECTED':
        return 'Rifiutata'
      case 'EXPIRED':
        return 'Scaduta'
    }
  }

  const getStatusColor = (status: SubstitutionStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'APPLIED':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'APPROVED':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'REJECTED':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'EXPIRED':
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const pendingCount = substitutions.filter(s => s.status === 'APPLIED').length

  return (
    <MainLayout adminOnly>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Minimalista */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Gestione Sostituzioni
              </h1>
              <p className="text-gray-600 mt-1">
                Approva o rifiuta le richieste di sostituzione
              </p>
            </div>
            {pendingCount > 0 && (
              <div className="bg-blue-100 rounded-lg px-4 py-2">
                <span className="text-blue-800 font-semibold text-sm">
                  {pendingCount} in attesa
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Filtri Minimalisti */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'ALL', label: 'Tutti' },
              { value: 'PENDING', label: 'In attesa' },
              { value: 'APPLIED', label: 'Da approvare' },
              { value: 'APPROVED', label: 'Approvate' },
              { value: 'REJECTED', label: 'Rifiutate' },
              { value: 'EXPIRED', label: 'Scadute' }
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFilterStatus(filter.value as SubstitutionStatus | 'ALL')}
                className={`
                  px-4 py-2 rounded text-sm font-medium transition
                  ${filterStatus === filter.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Substitutions List Minimalista */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Caricamento...</p>
            </div>
          ) : substitutions.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500">Nessuna sostituzione per il filtro selezionato</p>
            </div>
          ) : (
            substitutions.map((substitution) => {
              const shiftDate = getShiftDate(substitution.shifts)
              const canApprove = substitution.status === 'APPLIED'
              const canReject = ['PENDING', 'APPLIED'].includes(substitution.status)
              
              return (
                <div key={substitution.id} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden hover:shadow-md transition">
                  {/* Status Header */}
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded text-xs font-semibold ${getStatusColor(substitution.status)}`}>
                        {getStatusText(substitution.status)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(parseISO(substitution.createdAt), 'dd/MM HH:mm')}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Turno */}
                      <div className="border-l-4 border-gray-300 pl-4">
                        <h3 className="font-semibold text-gray-900 text-sm mb-2">Turno</h3>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Giorno:</span>
                            <span className="text-gray-900">{getDayName(substitution.shifts.dayOfWeek)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Data:</span>
                            <span className="text-gray-900">{format(shiftDate, 'dd/MM/yyyy')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Turno:</span>
                            <span className="text-gray-900">{getShiftTypeName(substitution.shifts.shiftType)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Orario:</span>
                            <span className="text-gray-900">{substitution.shifts.startTime} - {substitution.shifts.endTime}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Ruolo:</span>
                            <span className="text-gray-900">{getRoleName(substitution.shifts.role)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Richiesta */}
                      <div className="border-l-4 border-gray-300 pl-4">
                        <h3 className="font-semibold text-gray-900 text-sm mb-2">Richiesta</h3>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Da:</span>
                            <span className="text-gray-900">{substitution.requester.username}</span>
                          </div>
                          {substitution.requester.primaryRole && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Ruolo:</span>
                              <span className="text-gray-900">{getRoleName(substitution.requester.primaryRole)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-500">Scadenza:</span>
                            <span className="text-gray-900">{format(parseISO(substitution.deadline), 'dd/MM HH:mm')}</span>
                          </div>
                          {substitution.requestNote && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-gray-500 text-xs mb-1">Motivo:</p>
                              <p className="text-gray-900 text-xs italic">&quot;{substitution.requestNote}&quot;</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Sostituto */}
                      <div className="border-l-4 border-gray-300 pl-4">
                        <h3 className="font-semibold text-gray-900 text-sm mb-2">Sostituto</h3>
                        {substitution.substitute ? (
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Nome:</span>
                              <span className="text-gray-900">{substitution.substitute.username}</span>
                            </div>
                            {substitution.substitute.primaryRole && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Ruolo:</span>
                                <span className="text-gray-900">{getRoleName(substitution.substitute.primaryRole)}</span>
                              </div>
                            )}
                            <div className="mt-2 bg-green-50 border border-green-200 rounded p-2 text-center">
                              <p className="text-green-800 font-semibold text-xs">✓ Candidato Disponibile</p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-gray-400 text-xs py-4">
                            <p>Nessun candidato</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {(canApprove || canReject) && (
                      <div className="mt-4 flex justify-end space-x-2 pt-4 border-t border-gray-200">
                        {canReject && (
                          <button
                            onClick={() => {
                              setSelectedSubstitution(substitution)
                              setShowRejectModal(true)
                            }}
                            disabled={processingId === substitution.id}
                            className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Rifiuta
                          </button>
                        )}
                        {canApprove && (
                          <button
                            onClick={() => approveSubstitution(substitution.id)}
                            disabled={processingId === substitution.id}
                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingId === substitution.id ? 'Approvazione...' : 'Approva'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Response Note */}
                    {substitution.responseNote && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded p-3">
                        <p className="text-xs font-semibold text-red-800 mb-1">Motivo del rifiuto:</p>
                        <p className="text-xs text-red-700">{substitution.responseNote}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Reject Modal Minimalista */}
        {showRejectModal && selectedSubstitution && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
              {/* Header */}
              <div className="bg-gray-900 px-6 py-4 rounded-t-lg flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  Rifiuta Sostituzione
                </h2>
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    setSelectedSubstitution(null)
                    setRejectReason('')
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Info Alert */}
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-bold text-amber-900 mb-1">Attenzione</p>
                      <p className="text-amber-800">
                        Stai per rifiutare la richiesta di <strong>{selectedSubstitution.requester.username}</strong> per il turno{' '}
                        <strong>{getDayName(selectedSubstitution.shifts.dayOfWeek)} - {getShiftTypeName(selectedSubstitution.shifts.shiftType)}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Textarea */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Motivo del rifiuto <span className="text-gray-500">(opzionale)</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 resize-none"
                    placeholder="Motivo del rifiuto..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-lg flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    setSelectedSubstitution(null)
                    setRejectReason('')
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
                >
                  Annulla
                </button>
                <button
                  onClick={rejectSubstitution}
                  disabled={processingId === selectedSubstitution.id}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingId === selectedSubstitution.id ? 'Rifiuto...' : 'Rifiuta'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <ToastContainer />
    </MainLayout>
  )
}
