'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { Users, Clock, Calendar, CheckCircle, XCircle, AlertCircle, Send, User } from 'lucide-react'
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
  deadline: string
  createdAt: string
  shift: Shift
  requester: User
  substitute?: User
}

export default function SubstitutionRequestsPage() {
  const { data: session } = useSession()
  const [availableSubstitutions, setAvailableSubstitutions] = useState<Substitution[]>([])
  const [myRequests, setMyRequests] = useState<Substitution[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
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
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <div>
            <h1 className="text-xl sm:text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500 mr-2" />
              Richieste di Sostituzione
            </h1>
            <p className="text-gray-800 mt-1 text-sm sm:text-base">
              Vedi le richieste di altri colleghi e candidati per aiutarli
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
              <h2 className="text-lg font-semibold text-gray-900">Richieste Disponibili</h2>
              {availableSubstitutions.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-6 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-700">Nessuna richiesta disponibile al momento</p>
                </div>
              ) : (
                availableSubstitutions.map((substitution) => {
                  const shiftDate = getShiftDate(substitution.shift)
                  const canApply = substitution.status === 'PENDING' && !isPast(shiftDate)
                  const isAlreadyApplied = substitution.substitute?.id === session.user.id
                  
                  return (
                    <div key={substitution.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(substitution.status)}
                          <span className={`text-sm px-2 py-1 rounded-full border ${getStatusColor(substitution.status)}`}>
                            {getStatusText(substitution.status)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-700">
                          {format(parseISO(substitution.createdAt), 'dd/MM HH:mm', { locale: it })}
                        </span>
                      </div>
                      
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <h3 className="font-medium text-gray-900 mb-1">
                          {getDayName(substitution.shift.dayOfWeek)} - {getShiftTypeName(substitution.shift.shiftType)}
                        </h3>
                        <p className="text-sm text-gray-800 mb-1">
                          📅 {format(shiftDate, 'dd/MM/yyyy', { locale: it })} • ⏰ {substitution.shift.startTime} - {substitution.shift.endTime}
                        </p>
                        <p className="text-sm text-gray-800">
                          👨‍🍳 {getRoleName(substitution.shift.role)}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm text-gray-800">
                          <strong>Richiesto da:</strong> {substitution.requester.username}
                          {substitution.requester.primaryRole && (
                            <span className="ml-1 text-xs text-gray-700">
                              ({getRoleName(substitution.requester.primaryRole)})
                            </span>
                          )}
                        </p>
                        
                        {substitution.requestNote && (
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
                            <p className="text-sm text-gray-700">
                              <strong>Motivo:</strong> {substitution.requestNote}
                            </p>
                          </div>
                        )}

                        <p className="text-xs text-gray-700">
                          <strong>Scadenza candidature:</strong> {format(parseISO(substitution.deadline), 'dd/MM HH:mm', { locale: it })}
                        </p>

                        {substitution.substitute && (
                          <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                            <p className="text-sm text-blue-800">
                              <strong>Candidato:</strong> {substitution.substitute.username}
                              {isAlreadyApplied && <span className="ml-1 font-semibold">(Tu!)</span>}
                            </p>
                          </div>
                        )}
                      </div>

                      {canApply && !isAlreadyApplied && (
                        <Button
                          size="sm"
                          onClick={() => applyForSubstitution(substitution.id)}
                          disabled={applying === substitution.id}
                          isLoading={applying === substitution.id}
                          className="w-full"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Candidati per questa Sostituzione
                        </Button>
                      )}

                      {isAlreadyApplied && (
                        <div className="text-center py-2">
                          <span className="text-sm text-blue-600 font-medium">
                            ✓ Ti sei già candidato per questa sostituzione
                          </span>
                        </div>
                      )}

                      {!canApply && !isAlreadyApplied && substitution.status === 'PENDING' && (
                        <div className="text-center py-2">
                          <span className="text-sm text-gray-700">
                            Turno scaduto - non più disponibile
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* My Requests */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Le Mie Richieste</h2>
              {myRequests.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-6 text-center">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-700 mb-2">Non hai richieste di sostituzione</p>
                  <p className="text-sm text-gray-400">
                    Vai al tuo piano di lavoro per richiederne una
                  </p>
                </div>
              ) : (
                myRequests.map((substitution) => {
                  const shiftDate = getShiftDate(substitution.shift)
                  
                  return (
                    <div key={substitution.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(substitution.status)}
                          <span className={`text-sm px-2 py-1 rounded-full border ${getStatusColor(substitution.status)}`}>
                            {getStatusText(substitution.status)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-700">
                          {format(parseISO(substitution.createdAt), 'dd/MM HH:mm', { locale: it })}
                        </span>
                      </div>
                      
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <h3 className="font-medium text-gray-900 mb-1">
                          {getDayName(substitution.shift.dayOfWeek)} - {getShiftTypeName(substitution.shift.shiftType)}
                        </h3>
                        <p className="text-sm text-gray-800 mb-1">
                          📅 {format(shiftDate, 'dd/MM/yyyy', { locale: it })} • ⏰ {substitution.shift.startTime} - {substitution.shift.endTime}
                        </p>
                        <p className="text-sm text-gray-800">
                          👨‍🍳 {getRoleName(substitution.shift.role)}
                        </p>
                      </div>

                      {substitution.requestNote && (
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
                          <p className="text-sm text-gray-700">
                            <strong>Il tuo motivo:</strong> {substitution.requestNote}
                          </p>
                        </div>
                      )}

                      {substitution.substitute && (
                        <div className="bg-green-50 border border-green-200 rounded-md p-2">
                          <p className="text-sm text-green-800">
                            <strong>Candidato:</strong> {substitution.substitute.username}
                            {substitution.status === 'APPLIED' && (
                              <span className="ml-2 text-xs">(In attesa approvazione admin)</span>
                            )}
                          </p>
                        </div>
                      )}

                      {substitution.status === 'PENDING' && (
                        <div className="text-center py-2 bg-yellow-50 rounded-md">
                          <span className="text-sm text-yellow-700">
                            ⏳ In attesa di candidati
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
      <ToastContainer />
    </MainLayout>
  )
}
