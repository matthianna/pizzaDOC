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
        {/* Header Moderno */}
        <div className="bg-gradient-to-br from-purple-50 via-white to-pink-50 rounded-2xl shadow-lg border border-purple-100 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-4">
              {/* Icon Box */}
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                <Users className="h-7 w-7 text-white" />
              </div>
              
              {/* Title */}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Gestione Sostituzioni
                </h1>
                <p className="text-gray-600 font-medium mt-0.5">
                  Approva o rifiuta le richieste di sostituzione
                </p>
              </div>
            </div>

            {/* Badge Pending */}
            {pendingCount > 0 && (
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl px-5 py-3 shadow-md">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-white font-bold text-sm">
                    {pendingCount} {pendingCount === 1 ? 'richiesta' : 'richieste'} in attesa
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filtri Button Group */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'ALL', label: 'Tutti', icon: '📋' },
              { value: 'PENDING', label: 'In attesa', icon: '⏰' },
              { value: 'APPLIED', label: 'Da approvare', icon: '👤' },
              { value: 'APPROVED', label: 'Approvate', icon: '✅' },
              { value: 'REJECTED', label: 'Rifiutate', icon: '❌' },
              { value: 'EXPIRED', label: 'Scadute', icon: '⌛' }
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFilterStatus(filter.value as SubstitutionStatus | 'ALL')}
                className={`
                  px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200
                  ${filterStatus === filter.value
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                  }
                `}
              >
                <span className="mr-2">{filter.icon}</span>
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Substitutions List */}
        <div className="space-y-5">
          {loading ? (
            <div className="bg-white rounded-2xl shadow-lg p-16 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-500 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Caricamento sostituzioni...</p>
            </div>
          ) : substitutions.length === 0 ? (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl shadow-lg p-16 text-center border border-gray-200">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
                <Users className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Nessuna Sostituzione</h3>
              <p className="text-gray-600">Non ci sono sostituzioni per il filtro selezionato.</p>
            </div>
          ) : (
            substitutions.map((substitution) => {
              const shiftDate = getShiftDate(substitution.shifts)
              const canApprove = substitution.status === 'APPLIED'
              const canReject = ['PENDING', 'APPLIED'].includes(substitution.status)
              
              return (
                <div key={substitution.id} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300">
                  {/* Status Bar */}
                  <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-purple-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {getStatusIcon(substitution.status)}
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-sm font-bold border-2 ${getStatusColor(substitution.status)}`}>
                          {getStatusText(substitution.status)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">
                          Richiesta: {format(parseISO(substitution.createdAt), 'dd/MM HH:mm', { locale: it })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Turno Card */}
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-xl p-5 border border-orange-200">
                        <div className="flex items-center space-x-2 mb-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                            <Clock className="h-4 w-4 text-white" />
                          </div>
                          <h3 className="font-bold text-gray-900 text-lg">Turno</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Giorno:</span>
                            <span className="font-semibold text-gray-900">{getDayName(substitution.shifts.dayOfWeek)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Data:</span>
                            <span className="font-semibold text-gray-900">{format(shiftDate, 'dd/MM/yyyy', { locale: it })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Turno:</span>
                            <span className="font-semibold text-gray-900">{getShiftTypeName(substitution.shifts.shiftType)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Orario:</span>
                            <span className="font-semibold text-gray-900">{substitution.shifts.startTime} - {substitution.shifts.endTime}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Ruolo:</span>
                            <span className="font-semibold text-gray-900">{getRoleName(substitution.shifts.role)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Richiesta Card */}
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-5 border border-blue-200">
                        <div className="flex items-center space-x-2 mb-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                          <h3 className="font-bold text-gray-900 text-lg">Richiesta</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Da:</span>
                            <span className="font-semibold text-gray-900">{substitution.requester.username}</span>
                          </div>
                          {substitution.requester.primaryRole && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Ruolo:</span>
                              <span className="font-semibold text-gray-900">{getRoleName(substitution.requester.primaryRole)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-600">Scadenza:</span>
                            <span className="font-semibold text-gray-900">{format(parseISO(substitution.deadline), 'dd/MM HH:mm', { locale: it })}</span>
                          </div>
                          {substitution.requestNote && (
                            <div className="mt-3 pt-3 border-t border-blue-200">
                              <p className="text-xs text-gray-600 mb-1">Motivo:</p>
                              <p className="text-sm text-gray-900 italic font-medium">&quot;{substitution.requestNote}&quot;</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Sostituto Card */}
                      <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-5 border border-green-200">
                        <div className="flex items-center space-x-2 mb-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                          <h3 className="font-bold text-gray-900 text-lg">Sostituto</h3>
                        </div>
                        {substitution.substitute ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Nome:</span>
                              <span className="font-semibold text-gray-900">{substitution.substitute.username}</span>
                            </div>
                            {substitution.substitute.primaryRole && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Ruolo:</span>
                                <span className="font-semibold text-gray-900">{getRoleName(substitution.substitute.primaryRole)}</span>
                              </div>
                            )}
                            <div className="mt-3 bg-green-100 border-2 border-green-300 rounded-lg p-3 text-center">
                              <p className="text-green-800 font-bold text-xs flex items-center justify-center">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Candidato Disponibile
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-24">
                            <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
                            <p className="text-gray-500 font-medium text-sm">Nessun candidato</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {(canApprove || canReject) && (
                      <div className="mt-6 flex justify-end space-x-3 pt-6 border-t border-gray-200">
                        {canReject && (
                          <button
                            onClick={() => {
                              setSelectedSubstitution(substitution)
                              setShowRejectModal(true)
                            }}
                            disabled={processingId === substitution.id}
                            className="px-6 py-2.5 text-sm font-bold text-red-600 bg-white border-2 border-red-300 rounded-xl hover:bg-red-50 hover:border-red-400 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                          >
                            <X className="h-4 w-4" />
                            <span>Rifiuta</span>
                          </button>
                        )}
                        {canApprove && (
                          <button
                            onClick={() => approveSubstitution(substitution.id)}
                            disabled={processingId === substitution.id}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-green-500 to-green-600 rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                          >
                            {processingId === substitution.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Approvazione...</span>
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4" />
                                <span>Approva</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Response Note */}
                    {substitution.responseNote && (
                      <div className="mt-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-xl p-4">
                        <div className="flex items-start space-x-3">
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-red-800 mb-1">Motivo del rifiuto:</p>
                            <p className="text-sm text-red-700">{substitution.responseNote}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Reject Modal - Modern Design */}
        {showRejectModal && selectedSubstitution && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full transform transition-all">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-500 to-pink-500 px-6 py-5 rounded-t-2xl">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <XCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        Rifiuta Sostituzione
                      </h2>
                      <p className="text-red-100 text-sm mt-0.5">
                        Fornisci un motivo del rifiuto
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowRejectModal(false)
                      setSelectedSubstitution(null)
                      setRejectReason('')
                    }}
                    className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
                  >
                    <X className="h-5 w-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                {/* Info Alert */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-4">
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
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">
                    Motivo del rifiuto <span className="text-gray-500 font-normal">(opzionale)</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors resize-none"
                    placeholder="Spiega perché la sostituzione è stata rifiutata..."
                  />
                  <p className="text-xs text-gray-500">
                    Un motivo chiaro aiuta il richiedente a capire il rifiuto.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-2xl">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowRejectModal(false)
                      setSelectedSubstitution(null)
                      setRejectReason('')
                    }}
                    className="px-6 py-2.5 text-sm font-bold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={rejectSubstitution}
                    disabled={processingId === selectedSubstitution.id}
                    className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-red-500 to-red-600 rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {processingId === selectedSubstitution.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Rifiuto...</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        <span>Rifiuta Sostituzione</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <ToastContainer />
    </MainLayout>
  )
}
