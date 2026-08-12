'use client'

import { useState, useEffect, useMemo, type JSX } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { StatStrip } from '@/components/ui/stat-strip'
import { SectionBlock } from '@/components/ui/section-block'
import { EmptyState } from '@/components/ui/list-row'
import { WeekNavigator } from '@/components/ui/week-navigator'
import { Clock, AlertCircle, CheckCircle, XCircle, History, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { getRoleName, getShiftTypeName, cn } from '@/lib/utils'
import { TZDate } from '@date-fns/tz'
import {
  getWeekStart,
  addWeekCalendarDays,
  formatMonthYearIt,
  shiftCalendarDateUtc,
  formatDate,
  shortWeekdayItFromDate,
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
          dense
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
                          className="pd-card-header w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left pd-press"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold capitalize" style={{ color: 'var(--pd-text)' }}>
                              {month.month}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                              {month.shiftsCount} {month.shiftsCount === 1 ? 'turno' : 'turni'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--pd-text)' }}>
                              {formatDecimalHoursIt(month.totalHours)}
                            </p>
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
                          <div className="divide-y" style={{ borderColor: 'var(--pd-border)', borderTop: '1px solid var(--pd-border)' }}>
                            {month.details.map((detail, idx) => {
                              let parsedDate: Date | null = null
                              try {
                                // detail.date may be dd/MM/yyyy or ISO
                                if (detail.date.includes('/')) {
                                  const [dd, mm, yyyy] = detail.date.split('/').map(Number)
                                  parsedDate = new Date(Date.UTC(yyyy, mm - 1, dd))
                                } else {
                                  parsedDate = normalizeDate(detail.date)
                                }
                              } catch {
                                parsedDate = null
                              }

                              return (
                                <div
                                  key={`${detail.date}-${detail.startTime}-${idx}`}
                                  className="px-4 py-3 flex items-center gap-3"
                                >
                                  <div
                                    className="w-11 shrink-0 text-center py-1"
                                    style={{
                                      background: 'var(--pd-surface-muted)',
                                      borderRadius: 'var(--pd-radius)',
                                    }}
                                  >
                                    <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--pd-muted)' }}>
                                      {parsedDate ? shortWeekdayItFromDate(parsedDate) : '—'}
                                    </p>
                                    <p className="text-sm font-semibold tabular-nums leading-tight" style={{ color: 'var(--pd-text)' }}>
                                      {parsedDate ? String(parsedDate.getUTCDate()).padStart(2, '0') : '—'}
                                    </p>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                                      {getShiftTypeName(detail.shiftType)}
                                    </p>
                                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--pd-muted)' }}>
                                      {getRoleName(detail.role)} · {detail.startTime}–{detail.endTime}
                                    </p>
                                  </div>
                                  <p className="text-sm font-semibold tabular-nums shrink-0" style={{ color: 'var(--pd-text)' }}>
                                    {formatDecimalHoursIt(detail.hours)}
                                  </p>
                                </div>
                              )
                            })}
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
  const start = shift.startTime?.slice?.(0, 5) ?? shift.startTime
  const end = shift.endTime?.slice?.(0, 5) ?? shift.endTime

  let statusLine = `${getRoleName(shift.role)} · ${start}${end ? `–${end}` : ''}`
  let statusTone: { color: string; bg: string; label: string; icon: JSX.Element } | null = null

  if (wh?.status === 'APPROVED') {
    statusLine = `${wh.startTime}–${wh.endTime}`
    statusTone = {
      label: formatDecimalHoursIt(wh.totalHours),
      color: 'var(--pd-success)',
      bg: 'var(--pd-success-soft)',
      icon: getStatusIcon(wh.status),
    }
  } else if (wh?.status === 'PENDING') {
    statusLine = `${wh.startTime}–${wh.endTime} · ${formatDecimalHoursIt(wh.totalHours)}`
    statusTone = {
      label: getStatusText(wh.status),
      color: 'var(--pd-warning)',
      bg: 'var(--pd-warning-soft)',
      icon: getStatusIcon(wh.status),
    }
  } else if (wh?.status === 'REJECTED') {
    statusLine = wh.rejectionReason || 'Ore rifiutate — contatta l\'amministrazione'
    statusTone = {
      label: getStatusText(wh.status),
      color: 'var(--pd-danger)',
      bg: 'var(--pd-danger-soft)',
      icon: getStatusIcon(wh.status),
    }
  } else if (!wh && isPastShift) {
    statusLine = 'In attesa di registrazione dall\'amministrazione'
    statusTone = {
      label: 'Da registrare',
      color: 'var(--pd-muted)',
      bg: 'var(--pd-surface-muted)',
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    }
  } else if (!wh && !isPastShift) {
    statusLine = `${getRoleName(shift.role)} · turno non ancora iniziato`
    statusTone = {
      label: 'Programmato',
      color: 'var(--pd-muted)',
      bg: 'var(--pd-surface-muted)',
      icon: <Clock className="h-3.5 w-3.5" />,
    }
  }

  return (
    <div
      className="px-4 py-3.5 flex items-center gap-3"
      style={{ borderBottom: '1px solid var(--pd-border)' }}
      data-list-row
    >
      <div
        className="w-12 shrink-0 text-center py-1.5"
        style={{
          background: 'var(--pd-surface-muted)',
          borderRadius: 'var(--pd-radius)',
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--pd-muted)' }}>
          {shortWeekdayItFromDate(shiftDayUtc)}
        </p>
        <p className="text-base font-semibold tabular-nums leading-none mt-0.5" style={{ color: 'var(--pd-text)' }}>
          {String(shiftDayUtc.getUTCDate()).padStart(2, '0')}
        </p>
        <p className="text-[10px] mt-0.5 capitalize" style={{ color: 'var(--pd-muted)' }}>
          {format(shiftDayUtc, 'MMM', { locale: it })}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
          {getShiftTypeName(shift.shiftType)}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--pd-muted)' }}>
          {statusLine}
        </p>
      </div>

      {statusTone && (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold shrink-0 tabular-nums"
          style={{
            color: statusTone.color,
            background: statusTone.bg,
            borderRadius: 'var(--pd-radius-pill)',
          }}
        >
          {statusTone.icon}
          {statusTone.label}
        </span>
      )}
    </div>
  )
}
