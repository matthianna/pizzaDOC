'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, Clock, ChevronLeft, ChevronRight, MapPin, Users, AlertCircle, FileText } from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, subWeeks, isPast, isToday } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { Role, ShiftType } from '@prisma/client'
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
  schedule: {
    weekStart: string
  }
  workedHours?: {
    id: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    totalHours: number
  }
}

export default function SchedulePage() {
  const { data: session } = useSession()
  const [currentWeek, setCurrentWeek] = useState(() => {
    const now = new Date()
    return startOfWeek(now, { weekStartsOn: 1 }) // Lunedì
  })
  const [shifts, setShifts] = useState<Shift[]>([])
  const [substitutionRequests, setSubstitutionRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [requestNote, setRequestNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    if (session?.user?.id) {
      fetchMyShifts()
    }
  }, [session?.user?.id, currentWeek])

  const fetchMyShifts = async () => {
    setLoading(true)
    try {
      const weekStart = currentWeek.toISOString()
      const [shiftsResponse, substitutionsResponse] = await Promise.all([
        fetch(`/api/user/schedule?weekStart=${weekStart}`),
        fetch('/api/user/substitutions')
      ])
      
      if (shiftsResponse.ok && substitutionsResponse.ok) {
        const shiftsData = await shiftsResponse.json()
        const substitutionsData = await substitutionsResponse.json()
        setShifts(shiftsData)
        setSubstitutionRequests(substitutionsData.mine)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const goToPreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1))
  }

  const goToNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1))
  }

  const goToCurrentWeek = () => {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }

  const openSubstitutionModal = (shift: Shift) => {
    setSelectedShift(shift)
    setShowSubstitutionModal(true)
    setRequestNote('')
  }

  const createSubstitutionRequest = async () => {
    if (!selectedShift || !requestNote.trim()) {
      showToast('Inserisci il motivo della richiesta', 'error')
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
        showToast('Richiesta per sostituto creata!', 'success')
        setShowSubstitutionModal(false)
        setSelectedShift(null)
        setRequestNote('')
        fetchMyShifts() // Refresh per vedere se il turno è ancora disponibile
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

  const weekEnd = addDays(currentWeek, 6)
  const days = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i))

  // Raggruppa i turni per giorno
  const shiftsByDay = shifts.reduce((acc, shift) => {
    const day = shift.dayOfWeek === 0 ? 6 : shift.dayOfWeek - 1 // Converti domenica (0) a sabato (6)
    if (!acc[day]) acc[day] = []
    acc[day].push(shift)
    return acc
  }, {} as Record<number, Shift[]>)

  const getShiftTimes = (shiftType: ShiftType) => {
    return shiftType === 'PRANZO' ? '11:30 - 14:00' : '18:00 - 22:00'
  }

  const getSubstitutionForShift = (shiftId: string) => {
    return substitutionRequests.find(sub => sub.shiftId === shiftId)
  }

  const isShiftEnded = (shift: Shift) => {
    const now = new Date()
    const currentTime = now.getHours()
    const shiftDate = addDays(currentWeek, shift.dayOfWeek === 0 ? 6 : shift.dayOfWeek - 1)
    
    // Se il turno non è oggi, controlla se è passato
    if (!isToday(shiftDate)) {
      return isPast(shiftDate)
    }
    
    // Se è oggi, controlla l'orario
    return (shift.shiftType === 'PRANZO' && currentTime >= 14) || 
           (shift.shiftType === 'CENA' && currentTime >= 22)
  }

  const needsHoursEntry = (shift: Shift) => {
    return isShiftEnded(shift) && !shift.workedHours
  }

  if (!session) {
    return <div>Loading...</div>
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Calendar className="h-6 w-6 text-orange-500 mr-2" />
              Il Mio Piano di Lavoro
            </h1>
            <p className="text-gray-600 mt-1">
              Visualizza i tuoi turni assegnati per la settimana
            </p>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPreviousWeek}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 mr-1" />
              Settimana precedente
            </button>

            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900">
                {format(currentWeek, 'dd/MM/yyyy', { locale: it })} - {format(weekEnd, 'dd/MM/yyyy', { locale: it })}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {format(currentWeek, 'MMMM yyyy', { locale: it })}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={goToCurrentWeek}
                className="px-4 py-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors font-medium"
              >
                Questa settimana
              </button>
              <button
                onClick={goToNextWeek}
                className="flex items-center px-4 py-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
              >
                Settimana successiva
                <ChevronRight className="h-5 w-5 ml-1" />
              </button>
            </div>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          {days.map((day, dayIndex) => {
            const dayShifts = shiftsByDay[dayIndex] || []
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

            return (
              <div key={dayIndex} className={`bg-white rounded-xl shadow-lg border overflow-hidden ${isToday ? 'ring-3 ring-orange-400 border-orange-300' : 'border-gray-200'}`}>
                {/* Day Header */}
                <div className={`px-4 py-4 text-center ${isToday ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white' : 'bg-gradient-to-r from-gray-50 to-gray-100'}`}>
                  <div className={`text-lg font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>
                    {format(day, 'EEEE', { locale: it })}
                  </div>
                  <div className={`text-sm ${isToday ? 'text-orange-100' : 'text-gray-600'}`}>
                    {format(day, 'dd/MM', { locale: it })}
                  </div>
                  {isToday && (
                    <div className="text-xs text-orange-200 mt-1 font-bold">OGGI</div>
                  )}
                </div>

                {/* Shifts Content */}
                <div className="p-3 space-y-3 min-h-[300px]">
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                    </div>
                  ) : dayShifts.length > 0 ? (
                    <div className="space-y-4">
                      {dayShifts.map((shift) => {
                        const shiftDate = addDays(currentWeek, shift.dayOfWeek === 0 ? 6 : shift.dayOfWeek - 1)
                        const isFutureShift = !isPast(shiftDate)
                        const substitutionRequest = getSubstitutionForShift(shift.id)
                        const shiftEnded = isShiftEnded(shift)
                        const needsHours = needsHoursEntry(shift)
                        
                        return (
                          <div
                            key={shift.id}
                            className={`rounded-lg border-2 transition-all ${
                              shiftEnded 
                                ? 'bg-gray-50 border-gray-200 opacity-80' 
                                : shift.shiftType === 'PRANZO'
                                  ? 'bg-orange-50 border-orange-300'
                                  : 'bg-white border-gray-300'
                            }`}
                          >
                            {/* Header con badge */}
                            <div className={`px-4 py-3 flex items-center justify-between ${
                              shiftEnded 
                                ? 'bg-gray-100' 
                                : shift.shiftType === 'PRANZO'
                                  ? 'bg-orange-100'
                                  : 'bg-gray-50'
                            }`}>
                              <div className="flex items-center space-x-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${
                                  shiftEnded ? 'bg-gray-400' : 
                                  shift.shiftType === 'PRANZO' ? 'bg-orange-500' : 'bg-blue-500'
                                }`}></div>
                                <span className={`text-sm font-bold uppercase tracking-wide ${
                                  shiftEnded ? 'text-gray-600' : 'text-gray-900'
                                }`}>
                                  {getShiftTypeName(shift.shiftType)}
                                </span>
                              </div>
                              {shiftEnded && (
                                <span className="bg-gray-400 text-white px-2 py-0.5 rounded text-[10px] font-semibold">
                                  TERMINATO
                                </span>
                              )}
                            </div>

                            {/* Content - Ora più grande e leggibile */}
                            <div className="p-4 space-y-3">
                              {/* Time - Ora molto più evidente */}
                              <div className="text-center bg-white rounded-md py-3 border border-gray-200">
                                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                  Inizio
                                </div>
                                <div className={`text-3xl font-bold ${
                                  shiftEnded ? 'text-gray-500' : 'text-gray-900'
                                }`}>
                                  {shift.startTime}
                                </div>
                              </div>

                              {/* Role */}
                              <div className="flex items-center justify-center space-x-2 bg-white rounded-md py-2 border border-gray-200">
                                <MapPin className={`h-4 w-4 ${
                                  shiftEnded ? 'text-gray-400' : 'text-orange-500'
                                }`} />
                                <span className={`text-sm font-semibold ${
                                  shiftEnded ? 'text-gray-500' : 'text-gray-700'
                                }`}>
                                  {getRoleName(shift.role)}
                                </span>
                              </div>

                              {/* Hours Status */}
                              {shift.workedHours && (
                                <div className={`p-2 rounded-lg border text-center ${
                                  shift.workedHours.status === 'PENDING' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                                  shift.workedHours.status === 'APPROVED' ? 'bg-green-50 border-green-200 text-green-800' :
                                  'bg-red-50 border-red-200 text-red-800'
                                }`}>
                                  <div className="text-xs font-bold">
                                    {shift.workedHours.status === 'PENDING' && '⏳ In attesa'}
                                    {shift.workedHours.status === 'APPROVED' && '✅ Approvate'}
                                    {shift.workedHours.status === 'REJECTED' && '❌ Rifiutate'}
                                  </div>
                                  <div className="text-sm font-bold">
                                    {shift.workedHours.totalHours}h
                                  </div>
                                </div>
                              )}

                              {/* Need Hours Entry Alert */}
                              {needsHours && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                  <div className="text-center mb-2">
                                    <AlertCircle className="h-4 w-4 text-red-500 mx-auto" />
                                    <span className="text-xs font-bold text-red-800 block">
                                      Ore mancanti
                                    </span>
                                  </div>
                                  <a 
                                    href="/hours"
                                    className="inline-flex items-center justify-center w-full px-3 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                                  >
                                    <FileText className="h-3 w-3 mr-1" />
                                    Inserisci
                                  </a>
                                </div>
                              )}

                              {/* Substitution Status */}
                              {substitutionRequest && (
                                <div className={`p-2 rounded-lg border text-center ${
                                  substitutionRequest.status === 'PENDING' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                                  substitutionRequest.status === 'APPLIED' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                                  substitutionRequest.status === 'APPROVED' ? 'bg-green-50 border-green-200 text-green-800' :
                                  'bg-red-50 border-red-200 text-red-800'
                                }`}>
                                  <div className="text-xs font-bold">
                                    {substitutionRequest.status === 'PENDING' && '⏳ In attesa'}
                                    {substitutionRequest.status === 'APPLIED' && `✋ ${substitutionRequest.substitute?.username}`}
                                    {substitutionRequest.status === 'APPROVED' && '✅ Approvata'}
                                    {substitutionRequest.status === 'REJECTED' && '❌ Rifiutata'}
                                  </div>
                                </div>
                              )}

                              {/* Request Substitution Button */}
                              {isFutureShift && !substitutionRequest && !shiftEnded && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openSubstitutionModal(shift)}
                                  className={`w-full text-xs h-8 border transition-all font-medium ${
                                    shift.shiftType === 'PRANZO'
                                      ? 'text-orange-700 border-orange-300 hover:bg-orange-100'
                                      : 'text-blue-700 border-blue-300 hover:bg-blue-100'
                                  }`}
                                >
                                  <Users className="h-3 w-3 mr-1" />
                                  Sostituto
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-center">
                      <div className="text-gray-400">
                        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">Nessun turno</p>
                        <p className="text-xs text-gray-500">Riposo!</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        {shifts.length > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl shadow-lg border border-orange-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
              Riepilogo Settimana
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center bg-white rounded-xl p-6 shadow-md border border-orange-200">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {shifts.length}
                </div>
                <div className="text-sm font-semibold text-gray-700">Turni Totali</div>
              </div>
              <div className="text-center bg-white rounded-xl p-6 shadow-md border border-orange-200">
                <div className="text-3xl font-bold text-amber-600 mb-1">
                  {shifts.filter(s => s.shiftType === 'PRANZO').length}
                </div>
                <div className="text-sm font-semibold text-gray-700">Turni Pranzo</div>
              </div>
              <div className="text-center bg-white rounded-xl p-6 shadow-md border border-blue-200">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {shifts.filter(s => s.shiftType === 'CENA').length}
                </div>
                <div className="text-sm font-semibold text-gray-700">Turni Cena</div>
              </div>
            </div>
          </div>
        )}

        {/* Substitution Request Modal */}
        {showSubstitutionModal && selectedShift && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Cerca un Sostituto
                </h3>
                
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="text-sm font-medium text-gray-900">
                    {getDayName(selectedShift.dayOfWeek)} - {getShiftTypeName(selectedShift.shiftType)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {format(addDays(currentWeek, selectedShift.dayOfWeek === 0 ? 6 : selectedShift.dayOfWeek - 1), 'dd/MM/yyyy', { locale: it })}
                  </div>
                  <div className="text-xs text-gray-600">
                    {selectedShift.startTime} • {getRoleName(selectedShift.role)}
                  </div>
                </div>

                <Input
                  label="Motivo della richiesta"
                  placeholder="Spiega perché hai bisogno di un sostituto..."
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  multiline
                  rows={3}
                />

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSubstitutionModal(false)
                      setSelectedShift(null)
                      setRequestNote('')
                    }}
                  >
                    Annulla
                  </Button>
                  <Button
                    onClick={createSubstitutionRequest}
                    disabled={!requestNote.trim() || submitting}
                    isLoading={submitting}
                  >
                    Crea Richiesta
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
