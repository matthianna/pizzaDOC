'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Users, Check, X, Clock, Calendar, AlertCircle, CheckCircle, XCircle, User } from 'lucide-react'
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
  schedule: {
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
  shift: Shift
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
    const weekStart = new Date(shift.schedule.weekStart)
    return addDays(weekStart, shift.dayOfWeek === 0 ? 6 : shift.dayOfWeek - 1)
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Users className="h-6 w-6 text-orange-500 mr-2" />
              Gestione Sostituzioni
            </h1>
            <p className="text-gray-800 mt-1">
              Approva o rifiuta le richieste di sostituzione
            </p>
          </div>
          {pendingCount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <span className="text-blue-800 font-medium">
                {pendingCount} richieste in attesa di approvazione
              </span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-4">
            <div className="w-48">
              <ReactSelect
                label="Stato"
                options={[
                  { value: 'ALL', label: 'Tutti' },
                  { value: 'PENDING', label: 'In attesa candidati' },
                  { value: 'APPLIED', label: 'Da approvare' },
                  { value: 'APPROVED', label: 'Approvate' },
                  { value: 'REJECTED', label: 'Rifiutate' },
                  { value: 'EXPIRED', label: 'Scadute' }
                ]}
                value={{ 
                  value: filterStatus, 
                  label: filterStatus === 'ALL' ? 'Tutti' : 
                         filterStatus === 'PENDING' ? 'In attesa candidati' :
                         filterStatus === 'APPLIED' ? 'Da approvare' :
                         filterStatus === 'APPROVED' ? 'Approvate' :
                         filterStatus === 'REJECTED' ? 'Rifiutate' : 'Scadute'
                }}
                onChange={(option) => setFilterStatus(option?.value as SubstitutionStatus | 'ALL' || 'ALL')}
              />
            </div>
          </div>
        </div>

        {/* Substitutions List */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-gray-800">Caricamento sostituzioni...</p>
            </div>
          ) : substitutions.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna sostituzione</h3>
              <p className="text-gray-800">Non ci sono sostituzioni per il filtro selezionato.</p>
            </div>
          ) : (
            substitutions.map((substitution) => {
              const shiftDate = getShiftDate(substitution.shift)
              const canApprove = substitution.status === 'APPLIED'
              const canReject = ['PENDING', 'APPLIED'].includes(substitution.status)
              
              return (
                <div key={substitution.id} className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(substitution.status)}
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(substitution.status)}`}>
                          {getStatusText(substitution.status)}
                        </span>
                        <span className="text-sm text-gray-700">
                          Richiesta: {format(parseISO(substitution.createdAt), 'dd/MM HH:mm', { locale: it })}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Shift Info */}
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Turno</h3>
                        <div className="space-y-1 text-sm text-gray-900">
                          <p><strong>Giorno:</strong> {getDayName(substitution.shift.dayOfWeek)}</p>
                          <p><strong>Data:</strong> {format(shiftDate, 'dd/MM/yyyy', { locale: it })}</p>
                          <p><strong>Turno:</strong> {getShiftTypeName(substitution.shift.shiftType)}</p>
                          <p><strong>Orario:</strong> {substitution.shift.startTime} - {substitution.shift.endTime}</p>
                          <p><strong>Ruolo:</strong> {getRoleName(substitution.shift.role)}</p>
                        </div>
                      </div>

                      {/* Request Info */}
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Richiesta</h3>
                        <div className="space-y-1 text-sm text-gray-900">
                          <p><strong>Richiesto da:</strong> {substitution.requester.username}</p>
                          {substitution.requester.primaryRole && (
                            <p><strong>Ruolo:</strong> {getRoleName(substitution.requester.primaryRole)}</p>
                          )}
                          <p><strong>Scadenza:</strong> {format(parseISO(substitution.deadline), 'dd/MM HH:mm', { locale: it })}</p>
                          {substitution.requestNote && (
                            <div className="mt-2">
                              <p><strong>Motivo:</strong></p>
                              <p className="text-gray-800 italic">"{substitution.requestNote}"</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Substitute Info */}
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Sostituto</h3>
                        {substitution.substitute ? (
                          <div className="space-y-1 text-sm text-gray-900">
                            <p><strong>Nome:</strong> {substitution.substitute.username}</p>
                            {substitution.substitute.primaryRole && (
                              <p><strong>Ruolo:</strong> {getRoleName(substitution.substitute.primaryRole)}</p>
                            )}
                            <div className="mt-2 bg-blue-50 border border-blue-200 rounded-md p-2">
                              <p className="text-blue-800 text-xs">✓ Candidato disponibile</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-800 text-sm">Nessun candidato</p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {(canApprove || canReject) && (
                      <div className="mt-6 flex justify-end space-x-3">
                        {canReject && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedSubstitution(substitution)
                              setShowRejectModal(true)
                            }}
                            disabled={processingId === substitution.id}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Rifiuta
                          </Button>
                        )}
                        {canApprove && (
                          <Button
                            onClick={() => approveSubstitution(substitution.id)}
                            disabled={processingId === substitution.id}
                            isLoading={processingId === substitution.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Approva
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Response Note */}
                    {substitution.responseNote && (
                      <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
                        <p className="text-sm text-red-800">
                          <strong>Motivo rifiuto:</strong> {substitution.responseNote}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Reject Modal */}
        {showRejectModal && selectedSubstitution && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Rifiuta Sostituzione
                </h3>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    Stai per rifiutare la richiesta di sostituzione di{' '}
                    <strong>{selectedSubstitution.requester.username}</strong> per il turno{' '}
                    <strong>
                      {getDayName(selectedSubstitution.shift.dayOfWeek)} - {getShiftTypeName(selectedSubstitution.shift.shiftType)}
                    </strong>
                  </p>
                </div>

                <Input
                  label="Motivo del rifiuto (opzionale)"
                  placeholder="Spiega perché la sostituzione è stata rifiutata..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  multiline
                  rows={3}
                />

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRejectModal(false)
                      setSelectedSubstitution(null)
                      setRejectReason('')
                    }}
                  >
                    Annulla
                  </Button>
                  <Button
                    onClick={rejectSubstitution}
                    disabled={processingId === selectedSubstitution.id}
                    isLoading={processingId === selectedSubstitution.id}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Rifiuta Sostituzione
                  </Button>
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
