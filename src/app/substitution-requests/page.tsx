'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { Users, Clock, Calendar, CheckCircle, XCircle, AlertCircle, Send, User, Ban } from 'lucide-react'
import { format, parseISO, addDays, isPast } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { Role, ShiftType, SubstitutionStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
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
  deadline: string
  createdAt: string
  shifts: Shift
  requester: User
  substitute?: User
}

export default function SubstitutionRequestsPage() {
  const { data: session } = useSession()
  const [availableSubstitutions, setAvailableSubstitutions] = useState<Substitution[]>([])
  const [myRequests, setMyRequests] = useState<Substitution[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedSubstitutionToCancel, setSelectedSubstitutionToCancel] = useState<Substitution | null>(null)
  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    if (session?.user?.id) {
      fetchSubstitutions()
    }
  }, [session?.user?.id])

  const fetchSubstitutions = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/user/substitutions')
      if (response.ok) {
        const data = await response.json()
        setAvailableSubstitutions(data.available)
        setMyRequests(data.mine)
      }
    } catch (error) {
      console.error('Error fetching substitutions:', error)
      showToast('Errore nel caricamento', 'error')
    } finally {
      setLoading(false)
    }
  }

  const applyForSubstitution = async (substitutionId: string) => {
    setApplying(substitutionId)
    try {
      const response = await fetch(`/api/user/substitutions/${substitutionId}/apply`, {
        method: 'POST',
      })

      if (response.ok) {
        showToast('Ti sei candidato con successo!', 'success')
        fetchSubstitutions() // Refresh data
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nella candidatura', 'error')
      }
    } catch (error) {
      console.error('Error applying for substitution:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setApplying(null)
    }
  }

  const openCancelModal = (substitution: Substitution) => {
    setSelectedSubstitutionToCancel(substitution)
    setShowCancelModal(true)
  }

  const closeCancelModal = () => {
    setShowCancelModal(false)
    setSelectedSubstitutionToCancel(null)
  }

  const confirmCancelSubstitution = async () => {
    if (!selectedSubstitutionToCancel) return

    setCancelling(selectedSubstitutionToCancel.id)
    try {
      const response = await fetch(`/api/user/substitutions/${selectedSubstitutionToCancel.id}/cancel`, {
        method: 'POST',
      })

      if (response.ok) {
        showToast('Richiesta di sostituzione annullata con successo', 'success')
        closeCancelModal()
        fetchSubstitutions() // Refresh data
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nell\'annullamento', 'error')
      }
    } catch (error) {
      console.error('Error cancelling substitution:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setCancelling(null)
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
        return <AlertCircle className="h-4 w-4 text-gray-700" />
      case 'CANCELLED':
        return <Ban className="h-4 w-4 text-gray-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-700" />
    }
  }

  const getStatusText = (status: SubstitutionStatus) => {
    switch (status) {
      case 'PENDING':
        return 'In attesa candidati'
      case 'APPLIED':
        return 'Candidato trovato'
      case 'APPROVED':
        return 'Approvata'
      case 'REJECTED':
        return 'Rifiutata'
      case 'EXPIRED':
        return 'Scaduta'
      case 'CANCELLED':
        return 'Annullata'
      default:
        return status
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
      case 'CANCELLED':
        return 'bg-gray-50 text-gray-600 border-gray-300'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  if (!session) {
    return <div>Loading...</div>
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center tracking-tight">
              <div className="w-12 h-12 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg mr-4 animate-float">
                <Users className="h-6 w-6 text-white" />
              </div>
              Sostituzioni
            </h1>
            <p className="text-gray-500 mt-2 font-medium">
              Aiuta i tuoi colleghi candidandoti per i loro turni
            </p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-700">Caricamento richieste...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-4 sm:p-6">
            {/* Available Substitutions */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-2 h-6 bg-orange-500 rounded-full"></div>
                Richieste Disponibili
              </h2>
              {availableSubstitutions.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-gray-900 font-medium mb-1">Nessuna richiesta</h3>
                  <p className="text-gray-500 text-sm">Non ci sono richieste di sostituzione disponibili al momento</p>
                </div>
              ) : (
                availableSubstitutions.map((substitution) => {
                  const shiftDate = getShiftDate(substitution.shifts)
                  const [startHour, startMinute] = substitution.shifts.startTime.split(':').map(Number)
                  const shiftStartDateTime = new Date(shiftDate)
                  shiftStartDateTime.setHours(startHour, startMinute, 0, 0)

                  const canApply = substitution.status === 'PENDING' && !isPast(shiftStartDateTime)
                  const isAlreadyApplied = substitution.substitute?.id === session.user.id

                  return (
                    <div key={substitution.id} className="glass rounded-2xl shadow-soft border-0 overflow-hidden card-hover">
                      {/* Card Header */}
                      <div className="px-4 py-3 border-b border-white/20 flex items-center justify-between bg-white/30">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(substitution.status)}
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${getStatusColor(substitution.status)}`}>
                            {getStatusText(substitution.status)}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-400">
                          {format(parseISO(substitution.createdAt), 'dd MMM', { locale: it })}
                        </span>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Shift Details */}
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${substitution.shifts.shiftType === 'PRANZO' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                            <Calendar className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">
                              {getDayName(substitution.shifts.dayOfWeek)} - {getShiftTypeName(substitution.shifts.shiftType)}
                            </h3>
                            <p className="text-sm text-gray-600 mt-0.5">
                              {format(shiftDate, 'dd MMMM yyyy', { locale: it })}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs font-medium text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {substitution.shifts.startTime} - {substitution.shifts.endTime}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {getRoleName(substitution.shifts.role)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Request Info */}
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Richiesto da:</span>
                            <span className="font-medium text-gray-900">{substitution.requester.username}</span>
                          </div>
                          {substitution.requestNote && (
                            <div className="pt-2 border-t border-gray-200">
                              <p className="text-sm text-gray-600 italic">"{substitution.requestNote}"</p>
                            </div>
                          )}
                        </div>

                        {/* Action Button */}
                        {canApply && !isAlreadyApplied && (
                          <Button
                            size="sm"
                            onClick={() => applyForSubstitution(substitution.id)}
                            disabled={applying === substitution.id}
                            isLoading={applying === substitution.id}
                            className="w-full bg-gradient-primary hover:brightness-110 text-white shadow-lg shadow-orange-500/20 py-6 rounded-xl font-bold transition-all transform active:scale-95"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Candidati Ora
                          </Button>
                        )}

                        {isAlreadyApplied && (
                          <div className="w-full py-2 bg-blue-50 text-blue-700 rounded-lg text-center text-sm font-medium border border-blue-100">
                            ✓ Candidatura inviata
                          </div>
                        )}

                        {!canApply && !isAlreadyApplied && substitution.status === 'PENDING' && (
                          <div className="w-full py-2 bg-gray-100 text-gray-500 rounded-lg text-center text-sm font-medium">
                            Non disponibile
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* My Requests */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                Le Mie Richieste
              </h2>
              {myRequests.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-gray-900 font-medium mb-1">Nessuna richiesta</h3>
                  <p className="text-gray-500 text-sm">Non hai ancora creato richieste di sostituzione</p>
                </div>
              ) : (
                myRequests.map((substitution) => {
                  const shiftDate = getShiftDate(substitution.shifts)

                  return (
                    <div key={substitution.id} className="glass rounded-2xl shadow-soft border-0 overflow-hidden card-hover">
                      {/* Card Header */}
                      <div className="px-4 py-3 border-b border-white/20 flex items-center justify-between bg-white/30">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(substitution.status)}
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${getStatusColor(substitution.status)}`}>
                            {getStatusText(substitution.status)}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-400">
                          {format(parseISO(substitution.createdAt), 'dd MMM', { locale: it })}
                        </span>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Shift Details */}
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${substitution.shifts.shiftType === 'PRANZO' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                            <Calendar className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">
                              {getDayName(substitution.shifts.dayOfWeek)} - {getShiftTypeName(substitution.shifts.shiftType)}
                            </h3>
                            <p className="text-sm text-gray-600 mt-0.5">
                              {format(shiftDate, 'dd MMMM yyyy', { locale: it })}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs font-medium text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {substitution.shifts.startTime} - {substitution.shifts.endTime}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {getRoleName(substitution.shifts.role)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Request Info */}
                        {substitution.requestNote && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-start gap-2 text-sm text-gray-600">
                              <span className="font-semibold min-w-[60px]">Motivo:</span>
                              <span className="italic">{substitution.requestNote}</span>
                            </div>
                          </div>
                        )}

                        {/* Candidate Info */}
                        {substitution.substitute && (
                          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-blue-700 font-medium">Candidato:</span>
                              <span className="text-sm font-bold text-blue-900">{substitution.substitute.username}</span>
                            </div>
                            {substitution.status === 'APPLIED' && (
                              <p className="text-xs text-blue-600 mt-1">In attesa di approvazione admin</p>
                            )}
                          </div>
                        )}

                        {substitution.status === 'PENDING' && (
                          <div className="w-full py-2 bg-yellow-50 text-yellow-700 rounded-lg text-center text-sm font-medium border border-yellow-100">
                            ⏳ In attesa di candidati
                          </div>
                        )}

                        {/* Cancel Button - Show for PENDING or APPLIED */}
                        {['PENDING', 'APPLIED'].includes(substitution.status) && (
                          <Button
                            onClick={() => openCancelModal(substitution)}
                            size="sm"
                            className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            Annulla Richiesta
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && selectedSubstitutionToCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Ban className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Annulla Richiesta di Sostituzione</h3>
                <p className="text-sm text-gray-600">Questa azione è irreversibile</p>
              </div>
            </div>

            {/* Content */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-gray-800 mb-2">
                <strong>Turno:</strong> {getDayName(selectedSubstitutionToCancel.shifts.dayOfWeek)} - {getShiftTypeName(selectedSubstitutionToCancel.shifts.shiftType)}
              </p>
              <p className="text-sm text-gray-800 mb-2">
                <strong>Data:</strong> {format(getShiftDate(selectedSubstitutionToCancel.shifts), 'dd/MM/yyyy', { locale: it })}
              </p>
              <p className="text-sm text-gray-800">
                <strong>Orario:</strong> {selectedSubstitutionToCancel.shifts.startTime} - {selectedSubstitutionToCancel.shifts.endTime}
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                ⚠️ Annullando questa richiesta, dovrai nuovamente creare una nuova richiesta se cambierai idea.
                {selectedSubstitutionToCancel.substitute && (
                  <span className="block mt-2 font-semibold">
                    Il candidato {selectedSubstitutionToCancel.substitute.username} verrà notificato dell'annullamento.
                  </span>
                )}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={closeCancelModal}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800"
                disabled={!!cancelling}
              >
                Mantieni Richiesta
              </Button>
              <Button
                onClick={confirmCancelSubstitution}
                isLoading={!!cancelling}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {cancelling ? 'Annullamento...' : 'Conferma Annullamento'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </MainLayout>
  )
}
