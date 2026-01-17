'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { Clock, Send, AlertCircle, CheckCircle, XCircle, Calendar, History, Plus, BarChart3, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addDays, addWeeks, subWeeks, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'
import { getWeekStart } from '@/lib/date-utils'
import { Role, ShiftType, HoursStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton'

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
    return getWeekStart(new Date()) // Lunedì UTC normalizzato
  })
  const [shifts, setShifts] = useState<ShiftWithHours[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historyData, setHistoryData] = useState<any>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
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

        // ✅ Sort shifts by ACTUAL DATE (not just day of week)
        const sortedShifts = shiftsWithHours.sort((a: ShiftWithHours, b: ShiftWithHours) => {
          // Calcola la data effettiva del turno per A
          const weekStartA = new Date(a.schedule.weekStart)
          const shiftDateA = new Date(Date.UTC(
            weekStartA.getUTCFullYear(),
            weekStartA.getUTCMonth(),
            weekStartA.getUTCDate() + a.dayOfWeek
          ))

          // Calcola la data effettiva del turno per B
          const weekStartB = new Date(b.schedule.weekStart)
          const shiftDateB = new Date(Date.UTC(
            weekStartB.getUTCFullYear(),
            weekStartB.getUTCMonth(),
            weekStartB.getUTCDate() + b.dayOfWeek
          ))

          // Ordina per data effettiva
          if (shiftDateA.getTime() !== shiftDateB.getTime()) {
            return shiftDateA.getTime() - shiftDateB.getTime()
          }

          // Se stessa data, ordina per tipo turno (PRANZO prima di CENA)
          if (a.shiftType !== b.shiftType) {
            return a.shiftType === 'PRANZO' ? -1 : 1
          }

          return 0
        })

        setShifts(sortedShifts)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      showToast('Errore nel caricamento dei dati', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async (year: number = selectedYear) => {
    setHistoryLoading(true)
    try {
      const response = await fetch(`/api/user/hours-history?year=${year}`)
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

  const handleYearChange = (year: number) => {
    setSelectedYear(year)
    fetchHistory(year)
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

      // Se esiste già un record rifiutato, aggiorna invece di creare
      const isResubmission = shift.workedHours && shift.workedHours.status === 'REJECTED'
      const method = isResubmission ? 'PUT' : 'POST'
      const url = isResubmission
        ? `/api/user/worked-hours/${shift.workedHours?.id}`
        : '/api/user/worked-hours'

      const response = await fetch(url, {
        method,
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
        showToast(isResubmission ? 'Ore corrette e reinviate!' : 'Ore inviate per approvazione!', 'success')
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

  const goToPreviousWeek = () => setCurrentWeek(prev => getWeekStart(subWeeks(prev, 1)))
  const goToNextWeek = () => setCurrentWeek(prev => getWeekStart(addWeeks(prev, 1)))
  const goToCurrentWeek = () => setCurrentWeek(getWeekStart(new Date()))

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
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
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
            className="glass text-orange-700 border-0 shadow-soft hover:bg-orange-100 font-bold rounded-xl"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {showHistory ? 'Torna ai Turni' : 'Storico Completo'}
          </Button>
        </div>

        {/* Monthly Summary Card (Always Visible or prominent) */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : historyData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-5 border-0 shadow-soft flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ore Mese Corrente</p>
                <p className="text-2xl font-black text-gray-900">
                  {historyData.months.find((m: any) => m.month.toLowerCase().includes(format(new Date(), 'MMMM', { locale: it }).toLowerCase()))?.totalHours || 0}h
                </p>
              </div>
            </div>
            <div className="glass rounded-2xl p-5 border-0 shadow-soft flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-secondary rounded-2xl flex items-center justify-center shadow-lg">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Turni Mese</p>
                <p className="text-2xl font-black text-gray-900">
                  {historyData.months.find((m: any) => m.month.toLowerCase().includes(format(new Date(), 'MMMM', { locale: it }).toLowerCase()))?.shiftsCount || 0}
                </p>
              </div>
            </div>
            <div className="glass rounded-2xl p-5 border-0 shadow-soft flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-success rounded-2xl flex items-center justify-center shadow-lg">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Media Ore/Turno</p>
                <p className="text-2xl font-black text-gray-900">
                  {historyData.months.find((m: any) => m.month.toLowerCase().includes(format(new Date(), 'MMMM', { locale: it }).toLowerCase()))?.avgHoursPerShift || 0}h
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Week Navigation - Hidden when showing history */}
        {!showHistory && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            {/* Mobile View */}
            <div className="flex sm:hidden items-center justify-between">
              <Button variant="ghost" onClick={goToPreviousWeek} className="rounded-full p-2 h-10 w-10">
                <ChevronLeft className="h-6 w-6" />
              </Button>

              <div className="text-center" onClick={goToCurrentWeek}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {format(currentWeek, 'MMMM yyyy', { locale: it })}
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {format(currentWeek, 'd', { locale: it })} - {format(weekEnd, 'd', { locale: it })}
                </p>
              </div>

              <Button variant="ghost" onClick={goToNextWeek} className="rounded-full p-2 h-10 w-10">
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>

            {/* Desktop View */}
            <div className="hidden sm:flex items-center justify-between">
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
          <div className="glass rounded-2xl shadow-soft border-0 overflow-hidden">
            <div className="p-6 border-b border-white/20 bg-white/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-black text-gray-900 flex items-center tracking-tight">
                  <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-md mr-3">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  Storico Ore {selectedYear}
                </h2>
                <div className="flex flex-wrap items-center gap-4">
                  {historyData && historyData.availableYears && historyData.availableYears.length > 1 && (
                    <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-xl border border-white/20">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Anno:</span>
                      <select
                        value={selectedYear}
                        onChange={(e) => handleYearChange(parseInt(e.target.value))}
                        className="bg-transparent border-none text-sm font-black text-gray-900 focus:ring-0 cursor-pointer"
                      >
                        {historyData.availableYears.map((y: number) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {historyData && (
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-xl text-sm font-bold shadow-sm">
                        {historyData.totalYearHours}h totali
                      </div>
                      <div className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-xl text-sm font-bold shadow-sm">
                        {historyData.totalYearShifts} turni
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-500 font-medium tracking-wide">Caricamento storico...</p>
              </div>
            ) : historyData && historyData.months.length > 0 ? (
              <div className="divide-y divide-white/10">
                {[...historyData.months].reverse().map((month: any, index: number) => (
                  <div key={index} className="p-6 hover:bg-white/20 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                      <h3 className="text-2xl font-black text-gray-900 capitalize tracking-tight">
                        {month.month}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/50 rounded-2xl shadow-sm border border-white/20">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-black text-gray-900">{month.totalHours}h</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/50 rounded-2xl shadow-sm border border-white/20">
                          <Calendar className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-black text-gray-900">{month.shiftsCount} turni</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/50 rounded-2xl shadow-sm border border-white/20">
                          <BarChart3 className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-black text-gray-900">{month.avgHoursPerShift}h/turno</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {month.details.map((detail: any, detailIndex: number) => (
                        <div key={detailIndex} className="glass rounded-2xl p-4 border-0 shadow-soft card-hover">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-black text-gray-900">{detail.date}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${detail.shiftType === 'PRANZO' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                                  }`}>
                                  {getShiftTypeName(detail.shiftType)}
                                </span>
                                <span className="text-xs font-bold text-gray-500">{getRoleName(detail.role)}</span>
                              </div>
                            </div>
                            <div className="bg-gradient-primary text-white px-3 py-1 rounded-xl font-black text-sm shadow-md">
                              {detail.hours}h
                            </div>
                          </div>
                          <div className="flex items-center text-xs font-bold text-gray-400">
                            <Clock className="h-3 w-3 mr-1" />
                            {detail.startTime} - {detail.endTime}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <BarChart3 className="h-10 w-10 text-gray-300" />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">Nessun dato storico</h3>
                <p className="text-gray-500 font-medium">Non ci sono ore approvate per questo anno.</p>
              </div>
            )}
          </div>
        ) : (
          /* Shifts List */
          <div className="space-y-4">
            {loading ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </>
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
  const shiftDate = addDays(currentWeek, shift.dayOfWeek) // dayOfWeek è già corretto: 0=Lunedì

  // ⏰ Calcola l'orario esatto di inizio del turno per determinare se è possibile inserire le ore
  const [shiftStartHour, shiftStartMinute] = shift.startTime.split(':').map(Number)
  const shiftStartDateTime = new Date(shiftDate)
  shiftStartDateTime.setHours(shiftStartHour, shiftStartMinute, 0, 0)

  // ✅ Il turno deve essere iniziato (non solo la data passata) per inserire le ore
  const hasShiftStarted = shiftStartDateTime <= new Date()
  const isPastShift = hasShiftStarted

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
    let endMinutes = endHour * 60 + endMin

    // Gestisce il passaggio della mezzanotte (00:00, 00:30)
    if (endHour < startHour) {
      endMinutes += 24 * 60 // Aggiunge 24 ore
    }

    const totalMinutes = endMinutes - startMinutes
    return Math.round((totalMinutes / 60) * 2) / 2
  }

  const totalHours = calculateHours(startTime, endTime)
  const canSubmit = isPastShift && startTime && endTime && totalHours > 0 &&
    (!shift.workedHours || shift.workedHours.status === 'REJECTED')

  return (
    <div className="glass rounded-xl shadow-soft overflow-hidden card-hover border-0">
      {/* Header with gradient */}
      <div className={`px-6 py-4 border-b border-white/20 ${shift.shiftType === 'PRANZO'
        ? 'bg-gradient-to-r from-amber-50/80 to-orange-50/80'
        : 'bg-gradient-to-r from-blue-50/80 to-indigo-50/80'
        }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${shift.shiftType === 'PRANZO' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
              }`}>
              {shift.shiftType === 'PRANZO' ? <span className="text-xl">☀️</span> : <span className="text-xl">🌙</span>}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {getDayName(shift.dayOfWeek)}
              </h3>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span className="font-medium text-gray-900">{getShiftTypeName(shift.shiftType)}</span>
                <span>•</span>
                <span>{format(shiftDate, 'dd/MM', { locale: it })}</span>
                <span>•</span>
                <span>{shift.startTime}</span>
              </div>
            </div>
          </div>

          {shift.workedHours && (
            <div className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center shadow-sm border ${getStatusColor(shift.workedHours.status)}`}>
              {getStatusIcon(shift.workedHours.status)}
              <span className="ml-1.5 uppercase tracking-wide">{getStatusText(shift.workedHours.status)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6">

        {shift.workedHours && shift.workedHours.status !== 'REJECTED' ? (
          // Show submitted hours (PENDING or APPROVED only)
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
          </div>
        ) : isPastShift ? (
          // Show input form for past shifts or rejected hours
          <div className="space-y-4">
            {/* Show rejection reason if hours were rejected */}
            {shift.workedHours && shift.workedHours.status === 'REJECTED' && shift.workedHours.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h5 className="text-sm font-semibold text-red-800 mb-1">Ore rifiutate - Correzioni richieste</h5>
                    <p className="text-sm text-red-700 mb-3">{shift.workedHours.rejectionReason}</p>
                    <div className="bg-red-100 rounded-lg p-3 text-xs text-red-600">
                      <strong>Ore precedenti:</strong> {shift.workedHours.startTime} - {shift.workedHours.endTime} ({shift.workedHours.totalHours}h)
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200">
              <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center">
                <Clock className="h-4 w-4 text-orange-500 mr-2" />
                {shift.workedHours && shift.workedHours.status === 'REJECTED'
                  ? 'Correggi e reinvia le ore'
                  : 'Inserisci le ore lavorate'
                }
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:p-6">
                {/* Orario Inizio */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Orario inizio
                  </label>
                  <div className="relative">
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full appearance-none bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium shadow-sm hover:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                    >
                      <option value="">Seleziona orario</option>
                      {shift.shiftType === 'PRANZO' ? (
                        // Orari pranzo
                        <>
                          <option value="10:30">10:30</option>
                          <option value="11:00">11:00</option>
                          <option value="11:30">11:30</option>
                          <option value="12:00">12:00</option>
                          <option value="12:30">12:30</option>
                        </>
                      ) : (
                        // Orari cena
                        <>
                          <option value="16:30">16:30</option>
                          <option value="17:00">17:00</option>
                          <option value="17:30">17:30</option>
                          <option value="18:00">18:00</option>
                          <option value="18:30">18:30</option>
                          <option value="19:00">19:00</option>
                          <option value="19:30">19:30</option>
                          <option value="20:00">20:00</option>
                        </>
                      )}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Orario Fine */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Orario fine
                  </label>
                  <div className="relative">
                    <select
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full appearance-none bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium shadow-sm hover:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                    >
                      <option value="">Seleziona orario</option>
                      {shift.shiftType === 'PRANZO' ? (
                        // Orari fine pranzo
                        <>
                          <option value="13:00">13:00</option>
                          <option value="13:30">13:30</option>
                          <option value="14:00">14:00</option>
                          <option value="14:30">14:30</option>
                          <option value="15:00">15:00</option>
                          <option value="15:30">15:30</option>
                        </>
                      ) : (
                        // Orari fine cena
                        <>
                          <option value="20:30">20:30</option>
                          <option value="21:00">21:00</option>
                          <option value="21:30">21:30</option>
                          <option value="22:00">22:00</option>
                          <option value="22:30">22:30</option>
                          <option value="23:00">23:00</option>
                          <option value="23:30">23:30</option>
                          <option value="00:00">00:00</option>
                          <option value="00:30">00:30</option>
                        </>
                      )}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Ore Totali */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Ore totali
                  </label>
                  <div className="relative">
                    <div className={`px-4 py-3 rounded-xl border-2 text-center font-bold text-lg transition-all ${totalHours > 0
                      ? 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-300 text-green-800'
                      : 'bg-gray-100 border-gray-200 text-gray-400'
                      }`}>
                      {totalHours > 0 ? `${totalHours}h` : '0h'}
                    </div>
                    {totalHours > 0 && (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t border-orange-200">
                <Button
                  onClick={() => onSubmitHours(shift, startTime, endTime)}
                  disabled={!canSubmit || submitting}
                  isLoading={submitting}
                  className={`w-full sm:w-auto flex items-center justify-center shadow-lg shadow-orange-500/20 text-white font-bold py-6 rounded-xl transition-all transform active:scale-95 ${shift.workedHours && shift.workedHours.status === 'REJECTED'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                    : 'bg-gradient-primary hover:brightness-110'
                    }`}
                  size="lg"
                >
                  <Send className="h-5 w-5 mr-2" />
                  {shift.workedHours && shift.workedHours.status === 'REJECTED'
                    ? 'Reinvia Correzione'
                    : 'Invia Ore'
                  }
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // Future shift - not yet started
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 text-center">
            <Clock className="h-8 w-8 text-amber-600 mx-auto mb-3" />
            <p className="text-amber-900 font-semibold text-lg mb-1">Turno non ancora iniziato</p>
            <p className="text-amber-700 text-sm mb-2">
              Potrai inserire le ore <strong>dopo le {shift.startTime}</strong>
            </p>
            <p className="text-amber-600 text-xs">
              ⏰ Il turno deve essere iniziato per poter registrare le ore lavorate
            </p>
          </div>
        )}
      </div>
    </div>
  )
}