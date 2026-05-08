'use client'

import { useState, useEffect, type JSX } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { Clock, AlertCircle, CheckCircle, XCircle, Calendar, History, BarChart3, TrendingUp, ChevronLeft, ChevronRight, Timer } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName, cn } from '@/lib/utils'
import { TZDate } from '@date-fns/tz'
import {
  getWeekStart,
  addWeekCalendarDays,
  formatMonthYearIt,
  shiftCalendarDateUtc,
} from '@/lib/date-utils'
import { normalizeDate } from '@/lib/normalize-date'
import { Role, ShiftType, HoursStatus } from '@prisma/client'
import { useToast } from '@/components/ui/toast'
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton'
import { useHaptics } from '@/hooks/use-haptics'

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
  const [showHistory, setShowHistory] = useState(false)
  const [historyData, setHistoryData] = useState<any>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const { showToast, ToastContainer } = useToast()
  const { lightClick } = useHaptics()

  useEffect(() => {
    if (session?.user?.id) {
      fetchShiftsAndHours()
    }
  }, [session?.user?.id, currentWeek])

  const fetchShiftsAndHours = async () => {
    setLoading(true)
    try {
      const weekStartIso = currentWeek.toISOString()

      const shiftsResponse = await fetch(
        `/api/user/schedule?weekStart=${encodeURIComponent(weekStartIso)}`,
        { cache: 'no-store' }
      )
      if (!shiftsResponse.ok) {
        showToast('Errore nel caricamento dei dati', 'error')
        return
      }

      const shiftsPayload = await shiftsResponse.json()
      const shiftsData = shiftsPayload.shifts ?? []
      const resolvedWeekIso =
        typeof shiftsPayload.weekStart === 'string'
          ? normalizeDate(shiftsPayload.weekStart).toISOString()
          : weekStartIso

      const hoursResponse = await fetch(
        `/api/user/worked-hours?weekStart=${encodeURIComponent(resolvedWeekIso)}`,
        { cache: 'no-store' }
      )
      if (!hoursResponse.ok) {
        showToast('Errore nel caricamento dei dati', 'error')
        return
      }

      if (shiftsPayload.weekStart) {
        const normalized = normalizeDate(shiftsPayload.weekStart)
        setCurrentWeek(prev =>
          prev.getTime() === normalized.getTime() ? prev : normalized
        )
      }

      const hoursData = await hoursResponse.json()

      // Merge shifts with their worked hours
      const shiftsWithHours = shiftsData.map((shift: Shift) => ({
        ...shift,
        workedHours: hoursData.find((wh: WorkedHours) => wh.shiftId === shift.id)
      }))

      // ✅ Sort shifts by ACTUAL DATE (not just day of week)
      const sortedShifts = shiftsWithHours.sort((a: ShiftWithHours, b: ShiftWithHours) => {
        const shiftDateA = shiftCalendarDateUtc(a.schedule.weekStart, a.dayOfWeek)
        const shiftDateB = shiftCalendarDateUtc(b.schedule.weekStart, b.dayOfWeek)

        if (shiftDateA.getTime() !== shiftDateB.getTime()) {
          return shiftDateA.getTime() - shiftDateB.getTime()
        }

        if (a.shiftType !== b.shiftType) {
          return a.shiftType === 'PRANZO' ? -1 : 1
        }

        return 0
      })

      setShifts(sortedShifts)
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

  const goToPreviousWeek = () => {
    lightClick()
    setCurrentWeek(prev => addWeekCalendarDays(prev, -7))
  }
  const goToNextWeek = () => {
    lightClick()
    setCurrentWeek(prev => addWeekCalendarDays(prev, 7))
  }
  const goToCurrentWeek = () => {
    lightClick()
    setCurrentWeek(getWeekStart(new Date()))
  }

  const weekEnd = addWeekCalendarDays(currentWeek, 6)

  const getStatusIcon = (status: HoursStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4" />
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4" />
      case 'REJECTED':
        return <XCircle className="h-4 w-4" />
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
        return 'bg-yellow-50 text-yellow-700 border-yellow-100'
      case 'APPROVED':
        return 'bg-green-50 text-green-700 border-green-100'
      case 'REJECTED':
        return 'bg-red-50 text-red-700 border-red-100'
    }
  }

  if (!session) return null

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        {/* Premium Header */}
        <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-8 shadow-soft border border-gray-100">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60"></div>
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-orange-100 transform -rotate-3">
                <Clock className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-none">
                  Le Mie Ore Lavorate
                </h1>
                <p className="text-gray-500 mt-2 text-sm font-medium">
                  Consulta le ore registrate dall’amministrazione per i tuoi turni. Lo storico mostra solo ore approvate.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                lightClick()
                setShowHistory(!showHistory)
                if (!showHistory && !historyData) fetchHistory()
              }}
              className="px-6 py-3 bg-white border-2 border-gray-100 text-gray-900 rounded-2xl text-xs font-black uppercase tracking-widest shadow-sm hover:shadow-md hover:border-orange-200 transition-all active:scale-95 flex items-center gap-2"
            >
              {showHistory ? (
                <><ChevronLeft className="h-4 w-4 text-orange-600" /> Torna ai Turni</>
              ) : (
                <><History className="h-4 w-4 text-orange-600" /> Storico Completo</>
              )}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            <>
              <Skeleton className="h-28 rounded-[2rem]" />
              <Skeleton className="h-28 rounded-[2rem]" />
              <Skeleton className="h-28 rounded-[2rem]" />
            </>
          ) : historyData && (
            <>
              <DashboardStatCard 
                label="Ore Mese Corrente" 
                value={`${historyData.months.find((m: any) => m.month.toLowerCase().includes(format(new Date(), 'MMMM', { locale: it }).toLowerCase()))?.totalHours || 0}h`}
                icon={Clock} 
                color="orange" 
              />
              <DashboardStatCard 
                label="Turni del Mese" 
                value={historyData.months.find((m: any) => m.month.toLowerCase().includes(format(new Date(), 'MMMM', { locale: it }).toLowerCase()))?.shiftsCount || 0}
                icon={Calendar} 
                color="blue" 
              />
              <DashboardStatCard 
                label="Media Ore/Turno" 
                value={`${historyData.months.find((m: any) => m.month.toLowerCase().includes(format(new Date(), 'MMMM', { locale: it }).toLowerCase()))?.avgHoursPerShift || 0}h`}
                icon={TrendingUp} 
                color="green" 
              />
            </>
          )}
        </div>

        {!showHistory && (
          <>
            {/* Week Navigator */}
            <div className="bg-white rounded-[2rem] shadow-soft border border-gray-100 p-4 flex items-center justify-between">
              <button onClick={goToPreviousWeek} className="p-3 bg-gray-50 text-gray-400 hover:bg-orange-50 hover:text-orange-600 rounded-xl transition-all">
                <ChevronLeft className="h-6 w-6" />
              </button>
              
              <div className="text-center cursor-pointer group" onClick={goToCurrentWeek}>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] group-hover:text-orange-500 transition-colors">
                  {formatMonthYearIt(currentWeek)}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-lg font-black text-gray-900">{currentWeek.getUTCDate()}</span>
                  <div className="h-1 w-4 bg-gray-200 rounded-full" />
                  <span className="text-lg font-black text-gray-900">{weekEnd.getUTCDate()}</span>
                </div>
              </div>

              <button onClick={goToNextWeek} className="p-3 bg-gray-50 text-gray-400 hover:bg-orange-50 hover:text-orange-600 rounded-xl transition-all">
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>

            {/* Shifts Content */}
            <div className="space-y-6">
              {loading ? (
                <div className="space-y-4">
                  <CardSkeleton />
                  <CardSkeleton />
                </div>
              ) : shifts.length === 0 ? (
                <div className="bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100 py-20 text-center">
                  <Calendar className="h-16 w-16 text-gray-200 mx-auto mb-6" />
                  <p className="text-gray-400 font-black uppercase tracking-widest text-sm">Nessun turno assegnato per questa settimana</p>
                </div>
              ) : (
                shifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    getStatusIcon={getStatusIcon}
                    getStatusText={getStatusText}
                    getStatusColor={getStatusColor}
                  />
                ))
              )}
            </div>
          </>
        )}

        {showHistory && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* History Header Filter */}
            <div className="bg-white rounded-[2rem] shadow-soft border border-gray-100 p-6 flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Riepilogo {selectedYear}</h2>
              {historyData?.availableYears && historyData.availableYears.length > 1 && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Seleziona Anno</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearChange(parseInt(e.target.value))}
                    className="bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 text-sm font-black text-gray-900 focus:outline-none focus:border-orange-500"
                  >
                    {historyData.availableYears.map((y: number) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {historyLoading ? (
              <div className="py-20 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto" />
              </div>
            ) : historyData && historyData.months.length > 0 ? (
              <div className="space-y-10">
                {[...historyData.months].reverse().map((month: any, idx: number) => (
                  <div key={idx} className="space-y-4">
                    <div className="flex items-center justify-between px-4">
                      <h3 className="text-2xl font-black text-gray-900 capitalize tracking-tight">{month.month}</h3>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 text-[10px] font-black uppercase rounded-lg">{month.totalHours}h Totali</span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase rounded-lg">{month.shiftsCount} Turni</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {month.details.map((detail: any, dIdx: number) => (
                        <div key={dIdx} className="bg-white rounded-[2rem] p-5 shadow-soft border border-gray-50 group hover:shadow-lg transition-all duration-300">
                          <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-gray-50 flex flex-col items-center justify-center font-black text-gray-400">
                              <span className="text-lg leading-none">{detail.date.split(' ')[0]}</span>
                            </div>
                            <div className="px-3 py-1 bg-gradient-primary text-white rounded-lg font-black text-xs shadow-md">
                              {detail.hours}h
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-black text-gray-900 uppercase tracking-tight">{getShiftTypeName(detail.shiftType)}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{getRoleName(detail.role)}</p>
                          </div>
                          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center text-[10px] font-bold text-gray-400">
                            <Clock className="h-3 w-3 mr-1.5" />
                            {detail.startTime} - {detail.endTime}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100 py-20 text-center">
                <BarChart3 className="h-16 w-16 text-gray-200 mx-auto mb-6" />
                <p className="text-gray-400 font-black uppercase tracking-widest text-sm">Nessun dato storico per questo anno</p>
              </div>
            )}
          </div>
        )}
      </div>
      <ToastContainer />
    </MainLayout>
  )
}

function DashboardStatCard({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    orange: 'bg-orange-50 text-orange-600 shadow-orange-100',
    blue: 'bg-blue-50 text-blue-600 shadow-blue-100',
    green: 'bg-green-50 text-green-600 shadow-green-100'
  }
  return (
    <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-gray-100 flex items-center gap-5">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg", colors[color])}>
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black text-gray-900 leading-none">{value}</p>
      </div>
    </div>
  )
}

function ShiftCard({
  shift,
  getStatusIcon,
  getStatusText,
  getStatusColor,
}: {
  shift: ShiftWithHours
  getStatusIcon: (status: HoursStatus) => JSX.Element
  getStatusText: (status: HoursStatus) => string
  getStatusColor: (status: HoursStatus) => string
}) {
  const shiftDayUtc = shiftCalendarDateUtc(shift.schedule.weekStart, shift.dayOfWeek)
  const [shiftStartHour, shiftStartMinute] = shift.startTime.split(':').map(Number)
  const shiftStartInstant = new TZDate(
    shiftDayUtc.getUTCFullYear(),
    shiftDayUtc.getUTCMonth(),
    shiftDayUtc.getUTCDate(),
    shiftStartHour,
    shiftStartMinute,
    0,
    'Europe/Rome'
  )

  const isPastShift = shiftStartInstant.getTime() <= Date.now()
  const wh = shift.workedHours

  const readOnlyGrid = wh && wh.status !== 'REJECTED' && (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Orario registrato</p>
        <p className="text-lg font-black text-gray-900">
          {wh.startTime} — {wh.endTime}
        </p>
      </div>
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Totale ore</p>
        <p className="text-lg font-black text-gray-900">{wh.totalHours}h</p>
      </div>
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Registrato il</p>
        <p className="text-sm font-bold text-gray-600">
          {format(parseISO(wh.submittedAt), 'dd MMM, HH:mm', { locale: it })}
        </p>
      </div>
      {wh.status === 'PENDING' && (
        <div className="sm:col-span-3 bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-900 font-medium">
          In attesa di revisione da parte dell&apos;amministrazione.
        </div>
      )}
    </div>
  )

  return (
    <div className="bg-white rounded-[2.5rem] shadow-soft border border-gray-100 overflow-hidden group transition-all duration-300 hover:shadow-lg">
      <div
        className={cn(
          'px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50',
          shift.shiftType === 'PRANZO' ? 'bg-orange-50/30' : 'bg-indigo-50/30'
        )}
      >
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center font-black border border-gray-100">
            <span className="text-[10px] text-gray-400 uppercase leading-none">
              {getDayName(shift.dayOfWeek).substring(0, 3)}
            </span>
            <span className="text-xl text-gray-900 leading-none mt-1">{shiftDayUtc.getUTCDate()}</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-black text-gray-900 leading-none uppercase tracking-tight">
                {getShiftTypeName(shift.shiftType)}
              </h3>
              {wh && (
                <span
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm',
                    getStatusColor(wh.status)
                  )}
                >
                  {getStatusIcon(wh.status)}
                  {getStatusText(wh.status)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                {getRoleName(shift.role)}
              </span>
              <span className="text-[10px] font-black text-orange-600">INIZIO: {shift.startTime}</span>
            </div>
          </div>
        </div>

        {!isPastShift && (
          <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-2xl border border-orange-100 flex items-center gap-3">
            <Timer className="h-4 w-4 text-orange-500 animate-pulse" />
            <span className="text-[10px] font-black text-orange-700 uppercase tracking-widest">
              Inizio alle {shift.startTime}
            </span>
          </div>
        )}
      </div>

      <div className="p-8">
        {readOnlyGrid}
        {wh?.status === 'REJECTED' && (
          <div className="space-y-4">
            <div className="bg-red-50 rounded-3xl p-6 border-2 border-red-100 flex items-start gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h4 className="text-sm font-black text-red-900 uppercase tracking-tight">Motivo del rifiuto</h4>
                <p className="text-sm text-red-700 font-medium mt-1 leading-relaxed">
                  {wh.rejectionReason || '—'}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium leading-relaxed">
              Solo un amministratore può correggere e riapprovare queste ore. Contatta l&apos;ufficio se hai bisogno di
              chiarimenti.
            </p>
          </div>
        )}
        {!wh && isPastShift && (
          <div className="bg-gray-50 rounded-[2rem] border border-gray-100 py-8 px-6 text-center space-y-2">
            <Clock className="h-8 w-8 text-gray-300 mx-auto" />
            <p className="text-gray-700 font-bold text-sm">
              Le ore effettive di questo turno saranno registrate dall&apos;amministrazione.
            </p>
            <p className="text-gray-500 text-xs font-medium">Non è necessaria alcuna azione da parte tua.</p>
          </div>
        )}
        {!wh && !isPastShift && (
          <div className="bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200 py-10 text-center space-y-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
              <Clock className="h-6 w-6 text-gray-300" />
            </div>
            <div>
              <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Turno non ancora iniziato</p>
              <p className="text-gray-500 font-bold text-sm mt-1">
                Dopo il turno, l&apos;orario effettivo verrà registrato dall&apos;amministrazione.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
