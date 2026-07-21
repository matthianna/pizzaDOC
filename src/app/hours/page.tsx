'use client'

import { useState, useEffect, useMemo, type JSX, type ElementType } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { Clock, AlertCircle, CheckCircle, XCircle, Calendar, History, BarChart3, TrendingUp, ChevronLeft, ChevronRight, Timer, ChevronDown, UtensilsCrossed, Moon } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName, cn } from '@/lib/utils'
import { TZDate } from '@date-fns/tz'
import {
  getWeekStart,
  addWeekCalendarDays,
  formatMonthYearIt,
  shiftCalendarDateUtc,
  shortWeekdayItFromDate,
} from '@/lib/date-utils'
import { formatDecimalHoursIt } from '@/lib/format-hours-display'
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

interface HistoryShiftDetail {
  date: string
  role: string
  shiftType: ShiftType
  hours: number
  startTime: string
  endTime: string
}

interface HistoryMonth {
  month: string
  totalHours: number
  shiftsCount: number
  avgHoursPerShift: number
  details: HistoryShiftDetail[]
}

interface HistoryData {
  year: number
  months: HistoryMonth[]
  totalYearHours: number
  totalYearShifts: number
  availableYears: number[]
}

function parseItDate(dateStr: string): Date {
  const [dd, mm, yyyy] = dateStr.split('/').map(Number)
  return new Date(Date.UTC(yyyy, mm - 1, dd))
}

function getShiftTypeStyles(shiftType: ShiftType | string) {
  if (shiftType === 'PRANZO') {
    return {
      card: 'border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white',
      header: 'bg-amber-50/70 border-amber-100',
      badge: 'bg-amber-100 text-amber-800',
      dot: 'bg-amber-500',
      icon: UtensilsCrossed,
    }
  }
  return {
    card: 'border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 to-white',
    header: 'bg-indigo-50/70 border-indigo-100',
    badge: 'bg-indigo-100 text-indigo-800',
    dot: 'bg-indigo-600',
    icon: Moon,
  }
}

function getCurrentMonthData(months: HistoryMonth[]) {
  const currentMonthLabel = format(new Date(), 'MMMM', { locale: it }).toLowerCase()
  return months.find(m => m.month.toLowerCase().includes(currentMonthLabel))
}

export default function HoursPage() {
  const { data: session } = useSession()
  const [currentWeek, setCurrentWeek] = useState(() => {
    return getWeekStart(new Date()) // Lunedì UTC normalizzato
  })
  const [shifts, setShifts] = useState<ShiftWithHours[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [historyData, setHistoryData] = useState<HistoryData | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const { showToast, ToastContainer } = useToast()
  const { lightClick } = useHaptics()

  useEffect(() => {
    if (session?.user?.id) {
      fetchShiftsAndHours()
      fetchHistory(selectedYear)
    }
  }, [session?.user?.id, currentWeek])

  useEffect(() => {
    if (historyData?.months.length) {
      const latestMonth = [...historyData.months].reverse()[0]?.month
      if (latestMonth) {
        setExpandedMonths(new Set([latestMonth]))
      }
    }
  }, [historyData?.year, selectedYear])

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

  const toggleMonth = (month: string) => {
    lightClick()
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(month)) next.delete(month)
      else next.add(month)
      return next
    })
  }

  const currentMonthData = historyData ? getCurrentMonthData(historyData.months) : null

  const weekStats = useMemo(() => {
    const approved = shifts.filter(s => s.workedHours?.status === 'APPROVED')
    const pending = shifts.filter(s => s.workedHours?.status === 'PENDING')
    const missing = shifts.filter(s => !s.workedHours)
    const totalHours = approved.reduce((sum, s) => sum + (s.workedHours?.totalHours ?? 0), 0)
    return { approved: approved.length, pending: pending.length, missing: missing.length, totalHours }
  }, [shifts])

  const sortedHistoryMonths = useMemo(
    () => (historyData ? [...historyData.months].reverse() : []),
    [historyData]
  )

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
          {loading && !showHistory ? (
            <>
              <Skeleton className="h-28 rounded-[2rem]" />
              <Skeleton className="h-28 rounded-[2rem]" />
              <Skeleton className="h-28 rounded-[2rem]" />
            </>
          ) : showHistory && historyData ? (
            <>
              <DashboardStatCard
                label={`Ore Totali ${selectedYear}`}
                value={formatDecimalHoursIt(historyData.totalYearHours)}
                icon={Clock}
                color="orange"
              />
              <DashboardStatCard
                label={`Turni ${selectedYear}`}
                value={historyData.totalYearShifts}
                icon={Calendar}
                color="blue"
              />
              <DashboardStatCard
                label="Media Ore/Turno"
                value={formatDecimalHoursIt(
                  historyData.totalYearShifts > 0
                    ? historyData.totalYearHours / historyData.totalYearShifts
                    : 0
                )}
                icon={TrendingUp}
                color="green"
              />
            </>
          ) : historyData ? (
            <>
              <DashboardStatCard
                label="Ore Mese Corrente"
                value={formatDecimalHoursIt(currentMonthData?.totalHours ?? 0)}
                icon={Clock}
                color="orange"
              />
              <DashboardStatCard
                label="Turni del Mese"
                value={currentMonthData?.shiftsCount ?? 0}
                icon={Calendar}
                color="blue"
              />
              <DashboardStatCard
                label="Media Ore/Turno"
                value={formatDecimalHoursIt(currentMonthData?.avgHoursPerShift ?? 0)}
                icon={TrendingUp}
                color="green"
              />
            </>
          ) : historyLoading ? (
            <>
              <Skeleton className="h-28 rounded-[2rem]" />
              <Skeleton className="h-28 rounded-[2rem]" />
              <Skeleton className="h-28 rounded-[2rem]" />
            </>
          ) : null}
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

            {!loading && shifts.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <WeekStatPill label="Turni" value={shifts.length} color="gray" />
                <WeekStatPill label="Approvate" value={weekStats.approved} color="green" />
                <WeekStatPill label="In attesa" value={weekStats.pending} color="yellow" />
                <WeekStatPill
                  label="Ore approvate"
                  value={formatDecimalHoursIt(weekStats.totalHours)}
                  color="orange"
                />
              </div>
            )}

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
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* History Header */}
            <div className="bg-white rounded-[2rem] shadow-soft border border-gray-100 p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Riepilogo {selectedYear}</h2>
                  {historyData && historyData.totalYearShifts > 0 && (
                    <p className="text-sm text-gray-500 font-medium mt-1">
                      {formatDecimalHoursIt(historyData.totalYearHours)} su {historyData.totalYearShifts} turni approvati
                    </p>
                  )}
                </div>
                {historyData?.availableYears && historyData.availableYears.length > 1 && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Anno</span>
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

              {historyData && historyData.months.length > 1 && (
                <div className="space-y-2">
                  <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                    {sortedHistoryMonths.map((month) => {
                      const share = historyData.totalYearHours > 0
                        ? (month.totalHours / historyData.totalYearHours) * 100
                        : 0
                      return (
                        <div
                          key={month.month}
                          title={`${month.month}: ${formatDecimalHoursIt(month.totalHours)}`}
                          className="h-full bg-gradient-to-r from-orange-400 to-orange-500 first:rounded-l-full last:rounded-r-full opacity-80 hover:opacity-100 transition-opacity"
                          style={{ width: `${Math.max(share, 4)}%` }}
                        />
                      )
                    })}
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Distribuzione ore per mese
                  </p>
                </div>
              )}
            </div>

            {historyLoading ? (
              <div className="py-20 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto" />
              </div>
            ) : historyData && historyData.months.length > 0 ? (
              <div className="space-y-4">
                {sortedHistoryMonths.map((month) => (
                  <MonthSection
                    key={month.month}
                    month={month}
                    isExpanded={expandedMonths.has(month.month)}
                    onToggle={() => toggleMonth(month.month)}
                    yearTotalHours={historyData.totalYearHours}
                  />
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

function DashboardStatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: ElementType; color: 'orange' | 'blue' | 'green' }) {
  const colors = {
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

function WeekStatPill({ label, value, color }: { label: string; value: string | number; color: 'gray' | 'green' | 'yellow' | 'orange' }) {
  const colors = {
    gray: 'bg-gray-50 text-gray-700 border-gray-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    yellow: 'bg-amber-50 text-amber-700 border-amber-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
  }
  return (
    <div className={cn('rounded-2xl border px-4 py-3 text-center', colors[color])}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
      <p className="text-lg font-black mt-0.5">{value}</p>
    </div>
  )
}

function MonthSection({
  month,
  isExpanded,
  onToggle,
  yearTotalHours,
}: {
  month: HistoryMonth
  isExpanded: boolean
  onToggle: () => void
  yearTotalHours: number
}) {
  const monthShare = yearTotalHours > 0 ? (month.totalHours / yearTotalHours) * 100 : 0

  return (
    <div className="bg-white rounded-[2rem] shadow-soft border border-gray-100 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 sm:px-6 py-5 flex items-center justify-between gap-4 hover:bg-gray-50/80 transition-colors text-left"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Calendar className="h-5 w-5 text-orange-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-black text-gray-900 capitalize tracking-tight truncate">{month.month}</h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              {Math.round(monthShare)}% dell&apos;anno · media {formatDecimalHoursIt(month.avgHoursPerShift)}/turno
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <span className="hidden sm:inline px-3 py-1 bg-orange-100 text-orange-700 text-[10px] font-black rounded-lg normal-case">
            {formatDecimalHoursIt(month.totalHours)}
          </span>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase rounded-lg">
            {month.shiftsCount} turni
          </span>
          <ChevronDown className={cn('h-5 w-5 text-gray-400 transition-transform', isExpanded && 'rotate-180')} />
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 sm:px-6 pb-6 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {month.details.map((detail, idx) => (
              <HistoryShiftCard key={`${detail.date}-${detail.startTime}-${idx}`} detail={detail} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function HistoryShiftCard({ detail }: { detail: HistoryShiftDetail }) {
  const shiftDate = parseItDate(detail.date)
  const styles = getShiftTypeStyles(detail.shiftType)
  const ShiftIcon = styles.icon
  const weekday = shortWeekdayItFromDate(shiftDate)

  return (
    <div className={cn('rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden', styles.card)}>
      <div className={cn('px-4 py-3 border-b flex items-center justify-between gap-3', styles.header)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-white border border-white/80 shadow-sm flex flex-col items-center justify-center flex-shrink-0">
            <span className="text-[9px] font-black text-gray-400 uppercase leading-none">{weekday.slice(0, 3)}</span>
            <span className="text-base font-black text-gray-900 leading-none mt-0.5">{shiftDate.getUTCDate()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900 uppercase tracking-tight truncate">
              {getShiftTypeName(detail.shiftType)}
            </p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate">
              {getRoleName(detail.role)}
            </p>
          </div>
        </div>
        <div className="px-2.5 py-1 bg-gradient-primary text-white rounded-lg font-black text-xs shadow-md flex-shrink-0">
          {formatDecimalHoursIt(detail.hours)}
        </div>
      </div>

      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
          <Clock className="h-3.5 w-3.5" />
          <span>{detail.startTime} — {detail.endTime}</span>
        </div>
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase', styles.badge)}>
          <ShiftIcon className="h-3 w-3" />
          {detail.date}
        </span>
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
        <p className="text-lg font-black text-gray-900">{formatDecimalHoursIt(wh.totalHours)}</p>
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
