'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { Clock, Send, AlertCircle, CheckCircle, XCircle, Calendar, History, Plus, BarChart3, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, subWeeks, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { Role, ShiftType, HoursStatus } from '@prisma/client'
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
}

interface ShiftWithHours extends Shift {
  workedHours?: WorkedHours
}

export default function HoursPage() {
  const { data: session } = useSession()
  const [currentWeek, setCurrentWeek] = useState(() => {
    const now = new Date()
    return startOfWeek(now, { weekStartsOn: 1 })
  })
  const [shifts, setShifts] = useState<ShiftWithHours[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historyData, setHistoryData] = useState<any>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    if (session?.user?.id) {
      fetchShiftsAndHours()
    }
  }, [session?.user?.id, currentWeek])

  const fetchShiftsAndHours = async () => {
    setLoading(true)
    try {
      const weekStart = currentWeek.toISOString()
      
      // Fetch shifts and worked hours
      const [shiftsResponse, hoursResponse] = await Promise.all([
        fetch(`/api/user/schedule?weekStart=${weekStart}`),
        fetch(`/api/user/worked-hours?weekStart=${weekStart}`)
      ])
      
      if (shiftsResponse.ok && hoursResponse.ok) {
        const shiftsData = await shiftsResponse.json()
        const hoursData = await hoursResponse.json()
        
        // Merge shifts with their worked hours
        const shiftsWithHours = shiftsData.map((shift: Shift) => ({
          ...shift,
          workedHours: hoursData.find((wh: WorkedHours) => wh.shiftId === shift.id)
        }))
        
        setShifts(shiftsWithHours)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      showToast('Errore nel caricamento dei dati', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch(`/api/user/hours-history?year=${new Date().getFullYear()}`)
      if (response.ok) {
        const data = await response.json()
        setHistoryData(data)
      } else {
        showToast('Errore nel caricamento dello storico', 'error')
      }
    } catch (error) {
      console.error('Error fetching history:', error)
      showToast('Errore nel caricamento dello storico', 'error')
    } finally {
      setHistoryLoading(false)
    }
  }

  const calculateHours = (startTime: string, endTime: string): number => {
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    const totalMinutes = endMinutes - startMinutes
    return Math.round((totalMinutes / 60) * 2) / 2 // Round to nearest 0.5
  }

  const submitHours = async (shift: ShiftWithHours, startTime: string, endTime: string) => {
    if (!startTime || !endTime) {
      showToast('Inserisci orario di inizio e fine', 'error')
      return
    }

    if (startTime >= endTime) {
      showToast('L\'orario di fine deve essere dopo quello di inizio', 'error')
      return
    }

    setSubmitting(shift.id)
    
    try {
      const totalHours = calculateHours(startTime, endTime)
      
      const response = await fetch('/api/user/worked-hours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shiftId: shift.id,
          startTime,
          endTime,
          totalHours
        }),
      })

      if (response.ok) {
        showToast('Ore inviate per approvazione!', 'success')
        fetchShiftsAndHours() // Refresh data
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore nell\'invio', 'error')
      }
    } catch (error) {
      console.error('Error submitting hours:', error)
      showToast('Errore di connessione', 'error')
    } finally {
      setSubmitting(null)
    }
  }

  const goToPreviousWeek = () => setCurrentWeek(prev => subWeeks(prev, 1))
  const goToNextWeek = () => setCurrentWeek(prev => addWeeks(prev, 1))
  const goToCurrentWeek = () => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))

  const weekEnd = addDays(currentWeek, 6)

  const getStatusIcon = (status: HoursStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusText = (status: HoursStatus) => {
    switch (status) {
      case 'PENDING':
        return 'In attesa'
      case 'APPROVED':
        return 'Approvato'
      case 'REJECTED':
        return 'Rifiutato'
    }
  }

  const getStatusColor = (status: HoursStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'APPROVED':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'REJECTED':
        return 'bg-red-50 text-red-700 border-red-200'
    }
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
              <Clock className="h-6 w-6 text-orange-500 mr-2" />
              Ore Lavorate
            </h1>
            <p className="text-gray-800 mt-1">
              Inserisci le ore lavorate per i tuoi turni assegnati
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setShowHistory(!showHistory)
              if (!showHistory && !historyData) {
                fetchHistory()
              }
            }}
            className="text-orange-700 border-orange-300 hover:bg-orange-100"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {showHistory ? 'Settimana Corrente' : 'Storico Mensile'}
          </Button>
        </div>

        {/* Week Navigation - Hidden when showing history */}
        {!showHistory && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={goToPreviousWeek}>
                ← Settimana precedente
              </Button>

              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  {format(currentWeek, 'dd/MM/yyyy', { locale: it })} - {format(weekEnd, 'dd/MM/yyyy', { locale: it })}
                </h2>
                <p className="text-sm text-orange-600 mt-1 font-medium">
                  {format(currentWeek, 'MMMM yyyy', { locale: it })}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Button variant="outline" onClick={goToCurrentWeek}>
                  Questa settimana
                </Button>
                <Button variant="outline" onClick={goToNextWeek}>
                  Settimana successiva →
                </Button>
              </div>
            </div>
          </div>
        )}

        {showHistory ? (
          /* Monthly History */
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <TrendingUp className="h-5 w-5 text-orange-500 mr-2" />
                  Storico Ore {new Date().getFullYear()}
                </h2>
                {historyData && (
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{historyData.totalYearHours}h</span> totali • 
                    <span className="ml-1 font-medium">{historyData.totalYearShifts}</span> turni
                  </div>
                )}
              </div>
            </div>
            
            {historyLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-800">Caricamento storico...</p>
              </div>
            ) : historyData && historyData.months.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {historyData.months.map((month: any, index: number) => (
                  <div key={index} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 capitalize">
                        {month.month}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-medium">
                          {month.totalHours}h totali
                        </span>
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                          {month.shiftsCount} turni
                        </span>
                        <span className="text-gray-600">
                          Media: {month.avgHoursPerShift}h/turno
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {month.details.map((detail: any, detailIndex: number) => (
                        <div key={detailIndex} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-gray-900">{detail.date}</p>
                              <p className="text-sm text-gray-700">
                                {getRoleName(detail.role)} • {getShiftTypeName(detail.shiftType)}
                              </p>
                            </div>
                            <span className="text-sm font-medium text-orange-600">
                              {detail.hours}h
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            {detail.startTime} - {detail.endTime}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun dato storico</h3>
                <p className="text-gray-700">Non ci sono ore approvate per questo anno.</p>
              </div>
            )}
          </div>
        ) : (
          /* Shifts List */
          <div className="space-y-4">
            {loading ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-800">Caricamento turni...</p>
              </div>
            ) : shifts.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun turno assegnato</h3>
                <p className="text-gray-800">Non hai turni assegnati per questa settimana.</p>
              </div>
            ) : (
              shifts.map((shift) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  currentWeek={currentWeek}
                  onSubmitHours={submitHours}
                  submitting={submitting === shift.id}
                  getStatusIcon={getStatusIcon}
                  getStatusText={getStatusText}
                  getStatusColor={getStatusColor}
                />
              ))
            )}
          </div>
        )}
      </div>
      <ToastContainer />
    </MainLayout>
  )
}

// Componente separato per ogni turno
function ShiftCard({ 
  shift, 
  currentWeek, 
  onSubmitHours, 
  submitting, 
  getStatusIcon, 
  getStatusText, 
  getStatusColor 
}: {
  shift: ShiftWithHours
  currentWeek: Date
  onSubmitHours: (shift: ShiftWithHours, startTime: string, endTime: string) => void
  submitting: boolean
  getStatusIcon: (status: HoursStatus) => React.JSX.Element
  getStatusText: (status: HoursStatus) => string
  getStatusColor: (status: HoursStatus) => string
}) {
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  // Calculate the actual date of the shift
  const shiftDate = addDays(currentWeek, shift.dayOfWeek === 0 ? 6 : shift.dayOfWeek - 1)
  const isPastShift = shiftDate < new Date()

  // Set default times based on shift type
  useEffect(() => {
    if (!shift.workedHours) {
      if (shift.shiftType === 'PRANZO') {
        setStartTime('11:30')
        setEndTime('14:00')
      } else {
        setStartTime('18:00')
        setEndTime('22:00')
      }
    } else {
      setStartTime(shift.workedHours.startTime)
      setEndTime(shift.workedHours.endTime)
    }
  }, [shift])

  const calculateHours = (start: string, end: string): number => {
    if (!start || !end) return 0
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    const totalMinutes = endMinutes - startMinutes
    return Math.round((totalMinutes / 60) * 2) / 2
  }

  const totalHours = calculateHours(startTime, endTime)
  const canSubmit = !shift.workedHours && isPastShift && startTime && endTime && startTime < endTime

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {getDayName(shift.dayOfWeek)} - {getShiftTypeName(shift.shiftType)}
              </h3>
              <p className="text-sm text-gray-700">
                {format(shiftDate, 'dd/MM/yyyy', { locale: it })} • {getRoleName(shift.role)}
              </p>
              <p className="text-sm text-gray-700">
                Orario turno: {shift.startTime} - {shift.endTime}
              </p>
            </div>
          </div>

          {shift.workedHours && (
            <div className={`px-3 py-1 rounded-full border text-sm font-medium flex items-center ${getStatusColor(shift.workedHours.status)}`}>
              {getStatusIcon(shift.workedHours.status)}
              <span className="ml-2">{getStatusText(shift.workedHours.status)}</span>
            </div>
          )}
        </div>

        {shift.workedHours ? (
          // Show submitted hours
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-700">Orario effettivo:</span>
                <p className="font-medium text-gray-900">{shift.workedHours.startTime} - {shift.workedHours.endTime}</p>
              </div>
              <div>
                <span className="text-gray-700">Ore totali:</span>
                <p className="font-medium text-gray-900">{shift.workedHours.totalHours}h</p>
              </div>
              <div>
                <span className="text-gray-700">Inviato il:</span>
                <p className="font-medium text-gray-900">
                  {format(parseISO(shift.workedHours.submittedAt), 'dd/MM/yyyy HH:mm', { locale: it })}
                </p>
              </div>
            </div>
            
            {shift.workedHours.status === 'REJECTED' && shift.workedHours.rejectionReason && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-start">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Motivo rifiuto:</p>
                    <p className="text-sm text-red-700">{shift.workedHours.rejectionReason}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : isPastShift ? (
          // Show input form for past shifts
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Input
                  type="time"
                  label="Orario inizio"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <Input
                  type="time"
                  label="Orario fine"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ore totali
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm font-medium">
                  {totalHours > 0 ? `${totalHours}h` : '-'}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => onSubmitHours(shift, startTime, endTime)}
                disabled={!canSubmit || submitting}
                isLoading={submitting}
                className="flex items-center"
              >
                <Send className="h-4 w-4 mr-2" />
                Invia per approvazione
              </Button>
            </div>
          </div>
        ) : (
          // Future shift
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <Calendar className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p className="text-blue-700 font-medium">Turno futuro</p>
            <p className="text-blue-600 text-sm">Potrai inserire le ore dopo aver completato il turno</p>
          </div>
        )}
      </div>
    </div>
  )
}