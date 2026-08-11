'use client'

import { useState, useEffect, useMemo, type JSX } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { StatStrip } from '@/components/ui/stat-strip'
import { SectionBlock } from '@/components/ui/section-block'
import { ListRow, EmptyState } from '@/components/ui/list-row'
import { WeekNavigator } from '@/components/ui/week-navigator'
import { Clock, AlertCircle, CheckCircle, XCircle, History, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName, getShiftTypeName, cn } from '@/lib/utils'
import { TZDate } from '@date-fns/tz'
import {
  getWeekStart,
  addWeekCalendarDays,
  formatMonthYearIt,
  shiftCalendarDateUtc,
  formatDate,
} from '@/lib/date-utils'
import { formatDecimalHoursIt } from '@/lib/format-hours-display'
import { normalizeDate } from '@/lib/normalize-date'
import { Role, ShiftType, HoursStatus } from '@prisma/client'
import { useToast } from '@/components/ui/toast'
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

function getCurrentMonthData(months: HistoryMonth[]) {
  const currentMonthLabel = format(new Date(), 'MMMM', { locale: it }).toLowerCase()
  return months.find(m => m.month.toLowerCase().includes(currentMonthLabel))
}

export default function HoursPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()))
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
    if (session && session.user.trackHours === false) {
      router.replace('/dashboard')
    }
  }, [session, router])

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

      const shiftsWithHours = shiftsData.map((shift: Shift) => ({
        ...shift,
        workedHours: hoursData.find((wh: WorkedHours) => wh.shiftId === shift.id)
      }))

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

  if (!session) return null

  if (session.user.trackHours === false) {
    return null
  }

  const stripItems = showHistory && historyData
    ? [
        { label: `Ore ${selectedYear}`, value: formatDecimalHoursIt(historyData.totalYearHours) },
        { label: `Turni ${selectedYear}`, value: historyData.totalYearShifts },
        {
          label: 'Media/turno',
          value: formatDecimalHoursIt(
            historyData.totalYearShifts > 0
              ? historyData.totalYearHours / historyData.totalYearShifts
              : 0
          ),
        },
      ]
    : historyData
      ? [
          { label: 'Ore mese', value: formatDecimalHoursIt(currentMonthData?.totalHours ?? 0) },
          { label: 'Turni mese', value: currentMonthData?.shiftsCount ?? 0 },
          {
            label: 'Media/turno',
            value: formatDecimalHoursIt(currentMonthData?.avgHoursPerShift ?? 0),
          },
        ]
      : [
          { label: 'Turni', value: loading ? '…' : shifts.length },
          { label: 'Approvate', value: loading ? '…' : weekStats.approved },
          { label: 'In attesa', value: loading ? '…' : weekStats.pending },
          {
            label: 'Ore approvate',
            value: loading ? '…' : formatDecimalHoursIt(weekStats.totalHours),
          },
        ]

  return (
    <MainLayout contentWidth="4xl" title="Le mie ore" subtitle="Ore registrate dall'amministrazione">
      <div className="pd-page pb-20">
        <PageHeader
          title="Le mie ore"
          subtitle="Ore registrate dall'amministrazione"
          action={
            <button
              type="button"
              onClick={() => {
                lightClick()
                setShowHistory(!showHistory)
                if (!showHistory && !historyData) fetchHistory()
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold pd-press"
              style={{
                background: 'var(--pd-accent-soft)',
                color: 'var(--pd-accent)',
                borderRadius: 'var(--pd-radius-pill)',
              }}
            >
              <History className="h-4 w-4" />
              {showHistory ? 'Torna ai turni' : 'Storico'}
            </button>
          }
        />

        <StatStrip items={stripItems} columns={stripItems.length === 4 ? 4 : 3} />

        {!showHistory && (
          <>
            <WeekNavigator
              label={`${formatDate(currentWeek)} – ${formatDate(weekEnd)}`}
              hint={formatMonthYearIt(currentWeek)}
              onPrev={goToPreviousWeek}
              onNext={goToNextWeek}
              onToday={goToCurrentWeek}
              disabled={loading}
            />

            {loading ? (
              <div className="py-16 text-center text-sm" style={{ color: 'var(--pd-muted)' }}>
                Caricamento…
              </div>
            ) : shifts.length === 0 ? (
              <SectionBlock card>
                <EmptyState
                  title="Nessun turno questa settimana"
                  description="Le ore vengono registrate dall'amministrazione; puoi solo consultarle."
                />
              </SectionBlock>
            ) : (
              <SectionBlock
                title="Turni della settimana"
                subtitle={
                  weekStats.missing > 0
                    ? `${weekStats.missing} turni senza ore registrate`
                    : undefined
                }
                card
              >
                {shifts.map(shift => (
                  <HoursShiftRow
                    key={shift.id}
                    shift={shift}
                    getStatusIcon={getStatusIcon}
                    getStatusText={getStatusText}
                  />
                ))}
              </SectionBlock>
            )}
          </>
        )}

        {showHistory && (
          <div className="space-y-4">
            <SectionBlock
              title={`Resoconto ${selectedYear}`}
              subtitle={
                historyData && historyData.totalYearShifts > 0
                  ? `${formatDecimalHoursIt(historyData.totalYearHours)} su ${historyData.totalYearShifts} turni approvati`
                  : undefined
              }
              action={
                historyData?.availableYears && historyData.availableYears.length > 1 ? (
                  <select
                    value={selectedYear}
                    onChange={e => handleYearChange(parseInt(e.target.value))}
                    className="text-sm font-semibold px-3 py-2"
                    style={{
                      background: 'var(--pd-surface-muted)',
                      border: '1px solid var(--pd-border)',
                      borderRadius: 'var(--pd-radius)',
                      color: 'var(--pd-text)',
                    }}
                  >
                    {historyData.availableYears.map((y: number) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                ) : undefined
              }
            >
              {historyLoading ? (
                <div className="py-12 text-center text-sm" style={{ color: 'var(--pd-muted)' }}>
                  Caricamento storico…
                </div>
              ) : historyData && historyData.months.length > 0 ? (
                <div className="space-y-3">
                  {sortedHistoryMonths.map(month => {
                    const isExpanded = expandedMonths.has(month.month)
                    const monthShare =
                      historyData.totalYearHours > 0
                        ? (month.totalHours / historyData.totalYearHours) * 100
                        : 0

                    return (
                      <div
                        key={month.month}
                        className="overflow-hidden"
                        style={{
                          background: 'var(--pd-surface)',
                          border: '1px solid var(--pd-border)',
                          borderRadius: 'var(--pd-radius-lg)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleMonth(month.month)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left pd-press"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold capitalize" style={{ color: 'var(--pd-text)' }}>
                              {month.month}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                              {Math.round(monthShare)}% dell&apos;anno · media{' '}
                              {formatDecimalHoursIt(month.avgHoursPerShift)}/turno
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs tabular-nums font-semibold" style={{ color: 'var(--pd-text)' }}>
                              {formatDecimalHoursIt(month.totalHours)}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--pd-muted)' }}>
                              {month.shiftsCount} turni
                            </span>
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 transition-transform',
                                isExpanded && 'rotate-180'
                              )}
                              style={{ color: 'var(--pd-muted)' }}
                            />
                          </div>
                        </button>
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid var(--pd-border)' }}>
                            {month.details.map((detail, idx) => (
                              <ListRow
                                key={`${detail.date}-${detail.startTime}-${idx}`}
                                title={getShiftTypeName(detail.shiftType)}
                                subtitle={`${getRoleName(detail.role)} · ${detail.startTime}–${detail.endTime}`}
                                meta={formatDecimalHoursIt(detail.hours)}
                                trailing={
                                  <span className="text-[11px]" style={{ color: 'var(--pd-muted)' }}>
                                    {detail.date}
                                  </span>
                                }
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="pd-card">
                  <EmptyState title="Nessun dato storico per questo anno" />
                </div>
              )}
            </SectionBlock>
          </div>
        )}
      </div>
      <ToastContainer />
    </MainLayout>
  )
}

function HoursShiftRow({
  shift,
  getStatusIcon,
  getStatusText,
}: {
  shift: ShiftWithHours
  getStatusIcon: (status: HoursStatus) => JSX.Element
  getStatusText: (status: HoursStatus) => string
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

  let subtitle = `${getRoleName(shift.role)} · inizio ${shift.startTime}`
  if (wh && wh.status !== 'REJECTED') {
    subtitle = `${wh.startTime}–${wh.endTime} · ${formatDecimalHoursIt(wh.totalHours)}`
  } else if (wh?.status === 'REJECTED') {
    subtitle = wh.rejectionReason || 'Ore rifiutate — contatta l\'amministrazione'
  } else if (!wh && isPastShift) {
    subtitle = 'In attesa di registrazione dall\'amministrazione'
  } else if (!wh && !isPastShift) {
    subtitle = `Turno non ancora iniziato · ${getRoleName(shift.role)}`
  }

  return (
    <ListRow
      title={`${getDayName(shift.dayOfWeek)} · ${getShiftTypeName(shift.shiftType)}`}
      subtitle={subtitle}
      meta={String(shiftDayUtc.getUTCDate()).padStart(2, '0')}
      trailing={
        wh ? (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium"
            style={{
              color:
                wh.status === 'APPROVED'
                  ? 'var(--pd-success)'
                  : wh.status === 'REJECTED'
                    ? 'var(--pd-danger)'
                    : 'var(--pd-warning)',
            }}
          >
            {getStatusIcon(wh.status)}
            {getStatusText(wh.status)}
          </span>
        ) : isPastShift ? (
          <AlertCircle className="h-4 w-4" style={{ color: 'var(--pd-muted)' }} />
        ) : (
          <Clock className="h-4 w-4" style={{ color: 'var(--pd-muted)' }} />
        )
      }
    />
  )
}
