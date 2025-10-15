'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { Users, Plus, Clock, Calendar, CheckCircle, XCircle, AlertCircle, Send } from 'lucide-react'
import { format, parseISO, isPast, addDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { Role, ShiftType, SubstitutionStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  requester: {
    id: string
    username: string
  }
  substitute?: {
    id: string
    username: string
  }
}

export default function SubstitutionsPage() {
  const { data: session } = useSession()
  const [myShifts, setMyShifts] = useState<Shift[]>([])
  const [availableSubstitutions, setAvailableSubstitutions] = useState<Substitution[]>([])
  const [mySubstitutions, setMySubstitutions] = useState<Substitution[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [requestNote, setRequestNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    if (session?.user?.id) {
      fetchData()
    }
  }, [session?.user?.id])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [shiftsResponse, substitutionsResponse] = await Promise.all([
        fetch('/api/user/future-shifts'),
        fetch('/api/user/substitutions')
      ])
      
      if (shiftsResponse.ok && substitutionsResponse.ok) {
        const shiftsData = await shiftsResponse.json()
        const substitutionsData = await substitutionsResponse.json()
        
        setMyShifts(shiftsData)
        setAvailableSubstitutions(substitutionsData.available)
        setMySubstitutions(substitutionsData.mine)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      showToast('Errore nel caricamento dei dati', 'error')
    } finally {
      setLoading(false)
    }
  }

  const createSubstitutionRequest = async () => {
    if (!selectedShift || !requestNote.trim()) {
      showToast('Seleziona un turno e inserisci il motivo', 'error')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/user/substitutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shiftId: selectedShift.id,
          requestNote: requestNote.trim()
        }),
      })

      if (response.ok) {
        showToast('Richiesta di sostituzione creata!', 'success')
        setShowCreateModal(false)
        setSelectedShift(null)
        setRequestNote('')
        fetchData()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nella creazione', 'error')
      }
    } catch (error) {
      console.error('Error creating substitution:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const applyForSubstitution = async (substitutionId: string) => {
    setSubmitting(true)
    try {
      const response = await fetch(`/api/user/substitutions/${substitutionId}/apply`, {
        method: 'POST',
      })

      if (response.ok) {
        showToast('Ti sei candidato per la sostituzione!', 'success')
        fetchData()
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nella candidatura', 'error')
      }
    } catch (error) {
      console.error('Error applying for substitution:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setSubmitting(false)
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
        return <Users className="h-4 w-4 text-blue-500" />
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
        return 'Candidato trovato'
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

  if (!session) {
    return <div>Loading...</div>
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
              <Users className="h-6 w-6 text-orange-500 mr-2" />
              Sostituzioni
            </h1>
            <p className="text-gray-600 mt-1">
              Richiedi sostituzioni per i tuoi turni o candidati per sostituire altri
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Richiedi Sostituzione
          </Button>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-500">Caricamento...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:p-6">
            {/* Available Substitutions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Sostituzioni Disponibili</h2>
                {session?.user?.roles && session.user.roles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">I tuoi ruoli:</span>
                    <div className="flex gap-1">
                      {session.user.roles.map((role) => (
                        <span key={role} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                          {getRoleName(role)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {availableSubstitutions.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-6 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nessuna sostituzione disponibile</p>
                </div>
              ) : (
                availableSubstitutions.map((substitution) => {
                  const shiftDate = getShiftDate(substitution.shifts)
                  
                  // Check if user can apply based on multiple criteria
                  const userHasRequiredRole = session?.user?.roles?.includes(substitution.shifts.role) || false
                  const isNotPastDeadline = !isPast(shiftDate)
                  const isPending = substitution.status === 'PENDING'
                  const isNotOwnRequest = substitution.requesterId !== session?.user?.id
                  
                  const canApply = isPending && isNotPastDeadline && isNotOwnRequest && userHasRequiredRole
                  
                  return (
                    <div key={substitution.id} className="bg-white rounded-lg shadow p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(substitution.status)}
                          <span className={`text-sm px-2 py-1 rounded-full border ${getStatusColor(substitution.status)}`}>
                            {getStatusText(substitution.status)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {format(parseISO(substitution.createdAt), 'dd/MM HH:mm', { locale: it })}
                        </span>
                      </div>
                      
                      <div className="mb-3">
                        <h3 className="font-medium text-gray-900">
                          {getDayName(substitution.shifts.dayOfWeek)} - {getShiftTypeName(substitution.shifts.shiftType)}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {format(shiftDate, 'dd/MM/yyyy', { locale: it })} • {substitution.shifts.startTime}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            userHasRequiredRole 
                              ? 'bg-green-100 text-green-800 border border-green-200' 
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            {getRoleName(substitution.shifts.role)}
                          </span>
                          {!userHasRequiredRole && (
                            <span className="text-xs text-red-600 font-medium">
                              Ruolo non disponibile
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm text-gray-600">
                          <strong>Richiesto da:</strong> {substitution.requester.username}
                        </p>
                        {substitution.requestNote && (
                          <p className="text-sm text-gray-600 mt-1">
                            <strong>Motivo:</strong> {substitution.requestNote}
                          </p>
                        )}
                      </div>

                      {canApply ? (
                        <Button
                          size="sm"
                          onClick={() => applyForSubstitution(substitution.id)}
                          disabled={submitting}
                          className="w-full"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Candidati
                        </Button>
                      ) : (
                        <div className="w-full">
                          {!userHasRequiredRole ? (
                            <Button
                              size="sm"
                              disabled
                              className="w-full bg-gray-300 text-gray-500 cursor-not-allowed"
                            >
                              Ruolo non compatibile
                            </Button>
                          ) : !isPending ? (
                            <Button
                              size="sm"
                              disabled
                              className="w-full bg-gray-300 text-gray-500 cursor-not-allowed"
                            >
                              Non più disponibile
                            </Button>
                          ) : !isNotPastDeadline ? (
                            <Button
                              size="sm"
                              disabled
                              className="w-full bg-gray-300 text-gray-500 cursor-not-allowed"
                            >
                              Scaduto
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              disabled
                              className="w-full bg-gray-300 text-gray-500 cursor-not-allowed"
                            >
                              Non disponibile
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* My Substitutions */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Le Mie Richieste</h2>
              {mySubstitutions.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-6 text-center">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nessuna richiesta di sostituzione</p>
                </div>
              ) : (
                mySubstitutions.map((substitution) => {
                  const shiftDate = getShiftDate(substitution.shifts)
                  
                  return (
                    <div key={substitution.id} className="bg-white rounded-lg shadow p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(substitution.status)}
                          <span className={`text-sm px-2 py-1 rounded-full border ${getStatusColor(substitution.status)}`}>
                            {getStatusText(substitution.status)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {format(parseISO(substitution.createdAt), 'dd/MM HH:mm', { locale: it })}
                        </span>
                      </div>
                      
                      <div className="mb-3">
                        <h3 className="font-medium text-gray-900">
                          {getDayName(substitution.shifts.dayOfWeek)} - {getShiftTypeName(substitution.shifts.shiftType)}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {format(shiftDate, 'dd/MM/yyyy', { locale: it })} • {getRoleName(substitution.shifts.role)}
                        </p>
                        <p className="text-sm text-gray-600">
                          {substitution.shifts.startTime} - {substitution.shifts.endTime}
                        </p>
                      </div>

                      {substitution.requestNote && (
                        <div className="mb-3">
                          <p className="text-sm text-gray-600">
                            <strong>Motivo:</strong> {substitution.requestNote}
                          </p>
                        </div>
                      )}

                      {substitution.substitute && (
                        <div className="mb-3 bg-blue-50 p-3 rounded-md">
                          <p className="text-sm text-blue-800">
                            <strong>Candidato:</strong> {substitution.substitute.username}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Create Substitution Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 max-w-md w-full">
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Richiedi Sostituzione
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seleziona Turno
                    </label>
                    <select
                      value={selectedShift?.id || ''}
                      onChange={(e) => {
                        const shift = myShifts.find(s => s.id === e.target.value)
                        setSelectedShift(shift || null)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900"
                    >
                      <option value="">Scegli un turno...</option>
                      {myShifts.map((shift) => {
                        const shiftDate = getShiftDate(shift)
                        return (
                          <option key={shift.id} value={shift.id}>
                            {getDayName(shift.dayOfWeek)} {format(shiftDate, 'dd/MM', { locale: it })} - {getShiftTypeName(shift.shiftType)} ({getRoleName(shift.role)})
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  <Input
                    label="Motivo della richiesta"
                    placeholder="Spiega perché hai bisogno di una sostituzione..."
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    multiline
                    rows={3}
                  />

                  <div className="flex justify-end space-x-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCreateModal(false)
                        setSelectedShift(null)
                        setRequestNote('')
                      }}
                    >
                      Annulla
                    </Button>
                    <Button
                      onClick={createSubstitutionRequest}
                      disabled={!selectedShift || !requestNote.trim() || submitting}
                      isLoading={submitting}
                    >
                      Crea Richiesta
                    </Button>
                  </div>
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