'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, Clock, ChevronLeft, ChevronRight, MapPin, Users, AlertCircle, FileText } from 'lucide-react'
import { addWeeks, subWeeks, isPast, isToday } from 'date-fns'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import {
  getWeekStart,
  getWeekDays,
  addWeekCalendarDays,
  formatDate,
  formatMonthYearIt,
  shortWeekdayItFromDate,
} from '@/lib/date-utils'
import { Role, ShiftType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

interface Substitution {
  id: string
  shiftId: string
  status: 'PENDING' | 'APPLIED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  substitute?: {
    username: string
  }
}

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
    return getWeekStart(new Date()) // Lunedì UTC normalizzato
  })
  const [shifts, setShifts] = useState<Shift[]>([])
  const [substitutions, setSubstitutions] = useState<Substitution[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [requestNote, setRequestNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    if (session?.user?.id) {
      fetchMyShifts()
      fetchSubstitutions()
    }
  }, [session?.user?.id, currentWeek])

  const fetchMyShifts = async () => {
    setLoading(true)
    try {
      const weekStart = currentWeek.toISOString()
      const response = await fetch(`/api/user/schedule?weekStart=${weekStart}`)

      if (response.ok) {
        const shiftsData = await response.json()
        setShifts(shiftsData)
      }
    } catch (error) {
      console.error('Error fetching shifts:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSubstitutions = async () => {
    try {
      const response = await fetch('/api/user/substitutions')
      if (response.ok) {
        const data = await response.json()
        setSubstitutions(data.mine || [])
      }
    } catch (error) {
      console.error('Error fetching substitutions:', error)
    }
  }

  const goToPreviousWeek = () => {
    // ⭐ USA getWeekStart per garantire normalizzazione UTC corretta
    setCurrentWeek(prev => getWeekStart(subWeeks(prev, 1)))
  }

  const goToNextWeek = () => {
    // ⭐ USA getWeekStart per garantire normalizzazione UTC corretta
    setCurrentWeek(prev => getWeekStart(addWeeks(prev, 1)))
  }

  const goToCurrentWeek = () => {
    setCurrentWeek(getWeekStart(new Date()))
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
        fetchSubstitutions() // Refresh sostituzioni
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

  const weekEnd = addWeekCalendarDays(currentWeek, 6)
  const days = getWeekDays(currentWeek)

  // Raggruppa i turni per giorno
  // dayOfWeek è già nel formato corretto: 0=Lunedì, 6=Domenica (come definito in date-utils.ts)
  const shiftsByDay = shifts.reduce((acc, shift) => {
    const day = shift.dayOfWeek
    if (!acc[day]) acc[day] = []
    acc[day].push(shift)
    return acc
  }, {} as Record<number, Shift[]>)

  const getShiftTimes = (shiftType: ShiftType) => {
    return shiftType === 'PRANZO' ? '11:30 - 14:00' : '18:00 - 22:00'
  }

  const isShiftEnded = (shift: Shift) => {
    const now = new Date()
    const currentTime = now.getHours()
    const shiftDate = addWeekCalendarDays(currentWeek, shift.dayOfWeek) // dayOfWeek è già corretto: 0=Lunedì

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
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
              <Calendar className="h-6 w-6 text-orange-500 mr-2" />
              Il Mio Piano di Lavoro
            </h1>
            <p className="text-gray-600 mt-1">
              Visualizza i tuoi turni assegnati per la settimana
            </p>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="glass rounded-xl shadow-soft p-4 sm:p-6 mb-6">
          {/* Mobile View */}
          <div className="flex sm:hidden items-center justify-between">
            <button
              onClick={goToPreviousWeek}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors active:scale-95"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            <div className="text-center" onClick={goToCurrentWeek}>
              <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-1">
                {formatMonthYearIt(currentWeek)}
              </p>
              <p className="text-xl font-black text-gray-900">
                {currentWeek.getUTCDate()} - {weekEnd.getUTCDate()}
              </p>
            </div>

            <button
              onClick={goToNextWeek}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors active:scale-95"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          {/* Desktop View */}
          <div className="hidden sm:flex items-center justify-between">
            <button
              onClick={goToPreviousWeek}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 mr-1" />
              Settimana precedente
            </button>

            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {formatDate(currentWeek)} - {formatDate(weekEnd)}
              </h2>
              <p className="text-sm font-medium text-orange-600 mt-1 uppercase tracking-wide">
                {formatMonthYearIt(currentWeek)}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={goToCurrentWeek}
                className="px-4 py-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors font-bold"
              >
                Questa settimana
              </button>
              <button
                onClick={goToNextWeek}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
              >
                Settimana successiva
                <ChevronRight className="h-5 w-5 ml-1" />
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-4">
          <div className="flex flex-wrap items-center gap-3 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-100 border-2 border-orange-300"></div>
              <span className="text-sm font-medium text-gray-700">Pranzo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-300"></div>
              <span className="text-sm font-medium text-gray-700">Cena</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-100 border-2 border-gray-300"></div>
              <span className="text-sm font-medium text-gray-700">Turno Finito</span>
            </div>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
          {days.map((day, dayIndex) => {
            const dayShifts = shiftsByDay[dayIndex] || []
            const isToday =
              day.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)

            return (
              <div key={dayIndex} className={`glass rounded-xl shadow-sm border overflow-hidden flex flex-col transition-all duration-300 ${isToday ? 'ring-2 ring-orange-400 border-orange-300 shadow-glow-orange transform scale-[1.02]' : 'border-white/40 hover:border-orange-200'}`}>
                {/* Day Header */}
                <div className={`px-3 py-3 text-center border-b ${isToday ? 'bg-gradient-to-b from-orange-500 to-orange-600 text-white border-orange-500' : 'bg-gradient-to-b from-gray-50 to-gray-100 border-gray-100'}`}>
                  <div className={`text-sm font-black tracking-wider ${isToday ? 'text-white' : 'text-gray-500'}`}>
                    {shortWeekdayItFromDate(day).toUpperCase()}
                  </div>
                  <div className={`text-lg font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>
                    {String(day.getUTCDate()).padStart(2, '0')}
                  </div>
                  {isToday && (
                    <div className="text-[10px] text-orange-600 font-bold bg-white rounded-full px-2 py-0.5 inline-block mt-1 shadow-sm uppercase tracking-widest">Oggi</div>
                  )}
                </div>

                {/* Shifts Content */}
                <div className="p-2 space-y-2 flex-1 min-h-[160px] bg-white">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                    </div>
                  ) : dayShifts.length > 0 ? (
                    <div className="space-y-2">
                      {dayShifts.map((shift) => {
                        const shiftDate = addWeekCalendarDays(currentWeek, shift.dayOfWeek)
                        const [startHour, startMinute] = shift.startTime.split(':').map(Number)
                        const shiftStartDateTime = new Date(shiftDate)
                        shiftStartDateTime.setHours(startHour, startMinute, 0, 0)

                        const isFutureShift = !isPast(shiftStartDateTime)
                        const shiftEnded = isShiftEnded(shift)
                        const needsHours = needsHoursEntry(shift)

                        return (
                          <div
                            key={shift.id}
                            className={`rounded-lg border transition-all hover:shadow-md ${shiftEnded
                              ? 'bg-gray-50 border-gray-200 opacity-75'
                              : shift.shiftType === 'PRANZO'
                                ? 'bg-amber-50/50 border-amber-200'
                                : 'bg-blue-50/50 border-blue-200'
                              }`}
                          >
                            {/* Header */}
                            <div className={`px-2 py-1.5 border-b flex items-center justify-between ${shiftEnded
                              ? 'border-gray-200'
                              : shift.shiftType === 'PRANZO'
                                ? 'border-amber-100'
                                : 'border-blue-100'
                              }`}>
                              <div className="flex items-center space-x-1.5">
                                <div className={`w-2 h-2 rounded-full ${shiftEnded ? 'bg-gray-400' :
                                  shift.shiftType === 'PRANZO' ? 'bg-amber-500' : 'bg-blue-600'
                                  }`}></div>
                                <span className={`text-xs font-bold uppercase ${shiftEnded ? 'text-gray-600' : 'text-gray-900'
                                  }`}>
                                  {getShiftTypeName(shift.shiftType)}
                                </span>
                              </div>
                              {shiftEnded && (
                                <span className="text-[10px] font-bold text-gray-500 uppercase">Finito</span>
                              )}
                            </div>

                            {/* Content */}
                            <div className="p-2 space-y-2">
                              {/* Time & Role */}
                              <div className="text-center">
                                <div className={`text-lg font-bold tracking-tight ${shiftEnded ? 'text-gray-600' : 'text-gray-900'
                                  }`}>
                                  {shift.startTime}
                                </div>
                                <div className="flex items-center justify-center mt-0.5">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${shiftEnded
                                    ? 'bg-gray-200 text-gray-600'
                                    : 'bg-white border shadow-sm text-gray-700'
                                    }`}>
                                    {getRoleName(shift.role)}
                                  </span>
                                </div>
                              </div>

                              {/* Hours Status */}
                              {shift.workedHours && (
                                <div className={`p-1.5 rounded-md border text-center text-xs ${shift.workedHours.status === 'PENDING' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                                  shift.workedHours.status === 'APPROVED' ? 'bg-green-50 border-green-200 text-green-800' :
                                    'bg-red-50 border-red-200 text-red-800'
                                  }`}>
                                  <div className="font-bold flex items-center justify-center gap-1">
                                    {shift.workedHours.status === 'PENDING' && <Clock className="h-3 w-3" />}
                                    {shift.workedHours.status === 'APPROVED' && <div className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                                    {shift.workedHours.status === 'REJECTED' && <AlertCircle className="h-3 w-3" />}
                                    {shift.workedHours.totalHours}h
                                  </div>
                                </div>
                              )}

                              {/* Need Hours Entry Alert */}
                              {needsHours && (
                                <a
                                  href="/hours"
                                  className="flex items-center justify-center w-full px-2 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors gap-1"
                                >
                                  <AlertCircle className="h-3 w-3" />
                                  Inserisci Ore
                                </a>
                              )}

                              {/* Request Substitution Button / Status */}
                              {isFutureShift && !shiftEnded && (() => {
                                const existingSubstitution = substitutions.find(sub => sub.shiftId === shift.id)

                                if (existingSubstitution) {
                                  const statusConfig = {
                                    PENDING: { text: 'In attesa', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: '⏳' },
                                    APPLIED: { text: 'Candidature', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: '👥' },
                                    APPROVED: { text: 'Approvato', color: 'bg-green-50 text-green-700 border-green-200', icon: '✅' },
                                    REJECTED: { text: 'Rifiutato', color: 'bg-red-50 text-red-700 border-red-200', icon: '❌' },
                                    CANCELLED: { text: 'Annullato', color: 'bg-gray-50 text-gray-700 border-gray-200', icon: '🚫' }
                                  }
                                  const status = statusConfig[existingSubstitution.status] || statusConfig.PENDING

                                  return (
                                    <div className={`w-full text-xs py-1.5 border rounded-md flex items-center justify-center font-semibold ${status.color}`}>
                                      <span className="mr-1.5">{status.icon}</span>
                                      {status.text}
                                    </div>
                                  )
                                }

                                return (
                                  <button
                                    onClick={() => openSubstitutionModal(shift)}
                                    className={`w-full text-xs py-1.5 border rounded-md transition-all font-medium flex items-center justify-center gap-1 ${shift.shiftType === 'PRANZO'
                                      ? 'text-amber-700 border-amber-200 bg-white hover:bg-amber-50'
                                      : 'text-blue-700 border-blue-200 bg-white hover:bg-blue-50'
                                      }`}
                                  >
                                    <Users className="h-3 w-3" />
                                    Cerca Sostituto
                                  </button>
                                )
                              })()}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                        <Calendar className="h-6 w-6 text-gray-300" />
                      </div>
                      <p className="text-xs font-medium text-gray-400">Nessun turno</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        {shifts.length > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl shadow-lg border border-orange-200 p-4 sm:p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
              Riepilogo Settimana
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:p-6">
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
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Cerca un Sostituto
                </h3>

                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="text-sm font-medium text-gray-900">
                    {getDayName(selectedShift.dayOfWeek)} - {getShiftTypeName(selectedShift.shiftType)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {formatDate(addWeekCalendarDays(currentWeek, selectedShift.dayOfWeek))}
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
