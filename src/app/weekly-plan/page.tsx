'use client'

import { useMemo, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { WeekNavigator } from '@/components/ui/week-navigator'
import { EmptyState } from '@/components/ui/list-row'
import { Ban, Download, LayoutGrid, List, Sun, Moon } from 'lucide-react'
import {
  getWeekStart,
  addWeekCalendarDays,
  formatDayMonthIt,
  formatDayMonthYearIt,
  formatMonthYearIt,
  utcCalendarDateKey,
  appTodayCalendarDateKey,
  ensureUtcMondayWeekStart,
} from '@/lib/date-utils'
import { normalizeDate } from '@/lib/normalize-date'
import { getRoleName, formatUsername } from '@/lib/utils'
import { useHaptics } from '@/hooks/use-haptics'

const DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
const SHORT_DAYS = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM']
const ROLE_ORDER = ['PIZZAIOLO', 'CUCINA', 'SALA', 'FATTORINO'] as const

function roleTone(role: string): { bg: string; color: string } {
  switch (role) {
    case 'PIZZAIOLO':
      return { bg: 'var(--pd-accent-soft)', color: 'var(--pd-accent)' }
    case 'CUCINA':
      return { bg: 'var(--pd-warning-soft)', color: 'var(--pd-warning)' }
    case 'SALA':
      return { bg: 'var(--pd-success-soft)', color: 'var(--pd-success)' }
    case 'FATTORINO':
      return { bg: 'var(--pd-surface-muted)', color: 'var(--pd-muted)' }
    default:
      return { bg: 'var(--pd-surface-muted)', color: 'var(--pd-text)' }
  }
}

function sortShifts(shifts: any[]) {
  return [...shifts].sort((a, b) => {
    const ra = ROLE_ORDER.indexOf(a.role)
    const rb = ROLE_ORDER.indexOf(b.role)
    const roleCmp = (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb)
    if (roleCmp !== 0) return roleCmp
    return String(a.startTime).localeCompare(String(b.startTime))
  })
}

export default function WeeklyPlanPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.roles?.includes('ADMIN') ?? false
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()))
  const [data, setData] = useState<{ schedule: any; holidays: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const { lightClick, mediumClick } = useHaptics()
  const [activeTab, setActiveTab] = useState<'LIST' | 'GRID'>('GRID')

  useEffect(() => {
    fetchWeeklyPlan()
  }, [currentWeek])

  const fetchWeeklyPlan = async () => {
    setLoading(true)
    try {
      const weekStartStr = currentWeek.toISOString()
      const response = await fetch(
        `/api/weekly-plan?weekStart=${encodeURIComponent(weekStartStr)}`,
        { cache: 'no-store' }
      )
      if (response.ok) {
        const jsonData = await response.json()
        setData(jsonData)
        const ws = jsonData.schedule?.weekStart
        if (ws != null) {
          const normalized = ensureUtcMondayWeekStart(normalizeDate(ws))
          setCurrentWeek((prev) =>
            prev.getTime() === normalized.getTime() ? prev : normalized
          )
        }
      }
    } catch (error) {
      console.error('Error fetching weekly plan:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = () => {
    mediumClick()
    const weekStartStr = encodeURIComponent(currentWeek.toISOString())
    window.open(`/api/admin/schedule/${weekStartStr}/export-pdf`, '_blank')
  }

  const nextWeek = () => {
    lightClick()
    setCurrentWeek((prev) => addWeekCalendarDays(prev, 7))
  }

  const prevWeek = () => {
    lightClick()
    setCurrentWeek((prev) => addWeekCalendarDays(prev, -7))
  }

  const goToToday = () => {
    lightClick()
    setCurrentWeek(getWeekStart(new Date()))
  }

  const shiftsByDay = useMemo(() => {
    const map: Record<number, Record<string, any[]>> = {}
    for (let i = 0; i < 7; i++) {
      map[i] = { PRANZO: [], CENA: [] }
    }
    if (data?.schedule?.shifts) {
      data.schedule.shifts.forEach((shift: any) => {
        map[shift.dayOfWeek]?.[shift.shiftType]?.push(shift)
      })
      for (let i = 0; i < 7; i++) {
        map[i].PRANZO = sortShifts(map[i].PRANZO)
        map[i].CENA = sortShifts(map[i].CENA)
      }
    }
    return map
  }, [data])

  const weekStats = useMemo(() => {
    const shifts = data?.schedule?.shifts || []
    const people = new Set(shifts.map((s: any) => s.userId || s.user?.id)).size
    return {
      shifts: shifts.length,
      people,
      hasSchedule: Boolean(data?.schedule),
    }
  }, [data])

  const isToday = (dayIndex: number) =>
    utcCalendarDateKey(addWeekCalendarDays(currentWeek, dayIndex)) === appTodayCalendarDateKey()

  const holidaysForDay = (dayIndex: number) => {
    if (!data?.holidays?.length) return []
    const slotKey = utcCalendarDateKey(addWeekCalendarDays(currentWeek, dayIndex))
    return data.holidays.filter(
      (h) => utcCalendarDateKey(normalizeDate(h.date)) === slotKey
    )
  }

  return (
    <MainLayout contentWidth="6xl" title="Piano settimanale">
      <div className="pd-page pb-20">
        <PageHeader
          dense
          title="Piano settimanale"
          subtitle="Turni di tutta la squadra"
          action={
            isAdmin ? (
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold pd-press"
                style={{
                  background: 'var(--pd-surface)',
                  border: '1px solid var(--pd-border)',
                  borderRadius: 'var(--pd-radius-pill)',
                  color: 'var(--pd-text)',
                }}
              >
                <Download className="h-4 w-4" />
                PDF
              </button>
            ) : undefined
          }
        />

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <WeekNavigator
            label={`${formatDayMonthIt(currentWeek)} – ${formatDayMonthYearIt(addWeekCalendarDays(currentWeek, 6))}`}
            hint={
              !loading && weekStats.hasSchedule
                ? `${weekStats.shifts} turni · ${weekStats.people} ${weekStats.people === 1 ? 'persona' : 'persone'}`
                : undefined
            }
            onPrev={prevWeek}
            onNext={nextWeek}
            onToday={goToToday}
            disabled={loading}
            className="flex-1"
          />
          <div
            className="inline-flex p-0.5 self-start sm:self-auto shrink-0"
            style={{
              background: 'var(--pd-surface-muted)',
              borderRadius: 'var(--pd-radius-pill)',
              border: '1px solid var(--pd-border)',
            }}
          >
            {(
              [
                { id: 'LIST' as const, label: 'Lista', icon: List },
                { id: 'GRID' as const, label: 'Griglia', icon: LayoutGrid },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  lightClick()
                  setActiveTab(tab.id)
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold pd-press"
                style={{
                  borderRadius: 'var(--pd-radius-pill)',
                  background: activeTab === tab.id ? 'var(--pd-surface)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--pd-text)' : 'var(--pd-muted)',
                  boxShadow: activeTab === tab.id ? 'var(--pd-shadow)' : undefined,
                }}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <div
              className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
              style={{ borderColor: 'var(--pd-accent)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : !data?.schedule ? (
          <EmptyState
            title="Nessun piano per questa settimana"
            description="Il piano non è ancora stato generato o pubblicato."
          />
        ) : activeTab === 'LIST' ? (
          <div className="space-y-3">
            {DAYS.map((dayName, index) => {
              const dayHolidays = holidaysForDay(index)
              const date = addWeekCalendarDays(currentWeek, index)
              const dayIsToday = isToday(index)
              const pranzoShifts = shiftsByDay[index]?.PRANZO || []
              const cenaShifts = shiftsByDay[index]?.CENA || []
              const totalPeople = pranzoShifts.length + cenaShifts.length

              const isFullClosure = dayHolidays.some((h) => h.closureType === 'FULL_DAY')
              const isPranzoClosure =
                isFullClosure || dayHolidays.some((h) => h.closureType === 'PRANZO_ONLY')
              const isCenaClosure =
                isFullClosure || dayHolidays.some((h) => h.closureType === 'CENA_ONLY')

              const holidayHint = dayHolidays
                .map((h) => h.description)
                .filter(Boolean)
                .join(' · ')

              return (
                <section
                  key={index}
                  className="overflow-hidden"
                  style={{
                    background: 'var(--pd-surface)',
                    border: '1px solid var(--pd-border)',
                    borderRadius: 'var(--pd-radius-lg)',
                    boxShadow: dayIsToday ? 'var(--pd-shadow)' : undefined,
                  }}
                >
                  <header
                    className="px-4 py-3 flex flex-wrap items-center gap-2 justify-between"
                    style={{
                      background: dayIsToday
                        ? 'color-mix(in srgb, var(--pd-accent-soft) 55%, var(--pd-surface))'
                        : 'var(--pd-surface)',
                      borderBottom: '1px solid var(--pd-border)',
                    }}
                  >
                    <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
                      <h2 className="pd-display text-xl font-semibold tracking-tight" style={{ color: 'var(--pd-text)' }}>
                        {dayName}{' '}
                        <span className="tabular-nums">{date.getUTCDate()}</span>
                      </h2>
                      <span className="text-xs" style={{ color: 'var(--pd-muted)' }}>
                        {formatMonthYearIt(date)}
                      </span>
                      {dayIsToday ? (
                        <span
                          className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                          style={{
                            background: 'var(--pd-accent)',
                            color: 'var(--pd-accent-fg)',
                            borderRadius: 'var(--pd-radius-pill)',
                          }}
                        >
                          Oggi
                        </span>
                      ) : null}
                      {holidayHint ? (
                        <span
                          className="inline-flex px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: 'var(--pd-warning-soft)',
                            color: 'var(--pd-warning)',
                            borderRadius: 'var(--pd-radius-pill)',
                          }}
                        >
                          {holidayHint}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[11px] tabular-nums" style={{ color: 'var(--pd-muted)' }}>
                      {isFullClosure
                        ? 'Chiuso'
                        : `${totalPeople} ${totalPeople === 1 ? 'turno' : 'turni'}`}
                    </span>
                  </header>

                  <ShiftSlot
                    label="Pranzo"
                    icon={Sun}
                    closed={isPranzoClosure}
                    holidayName={holidayHint || undefined}
                    shifts={pranzoShifts}
                    currentUserId={session?.user?.id}
                  />
                  <ShiftSlot
                    label="Cena"
                    icon={Moon}
                    closed={isCenaClosure}
                    holidayName={holidayHint || undefined}
                    shifts={cenaShifts}
                    currentUserId={session?.user?.id}
                    last
                  />
                </section>
              )
            })}
          </div>
        ) : (
          <div
            className="overflow-x-auto"
            style={{
              background: 'var(--pd-surface)',
              border: '1px solid var(--pd-border)',
              borderRadius: 'var(--pd-radius-lg)',
            }}
          >
            <table className="min-w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--pd-border)' }}>
                  <th
                    className="px-3 py-3 text-left text-xs font-semibold sticky left-0 z-10"
                    style={{ color: 'var(--pd-muted)', background: 'var(--pd-surface)' }}
                  >
                    Turno
                  </th>
                  {DAYS.map((_, idx) => {
                    const date = addWeekCalendarDays(currentWeek, idx)
                    const dayIsToday = isToday(idx)
                    const gridHolidays = holidaysForDay(idx)
                    return (
                      <th
                        key={idx}
                        className="px-2 py-3 text-center min-w-[100px]"
                        style={{
                          background: dayIsToday ? 'var(--pd-accent-soft)' : 'var(--pd-surface-muted)',
                        }}
                      >
                        <p
                          className="text-[10px] font-semibold tracking-wide"
                          style={{ color: dayIsToday ? 'var(--pd-accent)' : 'var(--pd-muted)' }}
                        >
                          {SHORT_DAYS[idx]}
                        </p>
                        <p
                          className="pd-display text-xl font-semibold tabular-nums leading-none mt-0.5"
                          style={{ color: dayIsToday ? 'var(--pd-accent)' : 'var(--pd-text)' }}
                        >
                          {date.getUTCDate()}
                        </p>
                        {gridHolidays.length > 0 && (
                          <p className="text-[10px] mt-1 font-medium" style={{ color: 'var(--pd-warning)' }}>
                            Chiusura
                          </p>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {(['PRANZO', 'CENA'] as const).map((shiftType) => (
                  <tr key={shiftType} style={{ borderBottom: '1px solid var(--pd-border)' }}>
                    <td
                      className="px-3 py-3 text-xs font-semibold sticky left-0 z-10 align-top"
                      style={{ color: 'var(--pd-text)', background: 'var(--pd-surface)' }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {shiftType === 'PRANZO' ? (
                          <Sun className="h-3.5 w-3.5" style={{ color: 'var(--pd-warning)' }} />
                        ) : (
                          <Moon className="h-3.5 w-3.5" style={{ color: 'var(--pd-muted)' }} />
                        )}
                        {shiftType === 'PRANZO' ? 'Pranzo' : 'Cena'}
                      </span>
                    </td>
                    {DAYS.map((_, idx) => {
                      const gh = holidaysForDay(idx)
                      const isFullClosure = gh.some((h) => h.closureType === 'FULL_DAY')
                      const isClosed =
                        isFullClosure ||
                        gh.some((h) =>
                          shiftType === 'PRANZO'
                            ? h.closureType === 'PRANZO_ONLY'
                            : h.closureType === 'CENA_ONLY'
                        )
                      const slotShifts = shiftsByDay[idx]?.[shiftType] || []
                      const dayIsToday = isToday(idx)

                      return (
                        <td
                          key={idx}
                          className="px-1.5 py-2 align-top"
                          style={{
                            background: dayIsToday
                              ? 'color-mix(in srgb, var(--pd-accent-soft) 40%, transparent)'
                              : undefined,
                          }}
                        >
                          {isClosed ? (
                            <p
                              className="text-[11px] text-center py-3 font-semibold"
                              style={{ color: 'var(--pd-danger)' }}
                            >
                              Chiuso
                            </p>
                          ) : slotShifts.length > 0 ? (
                            <div className="space-y-1">
                              {slotShifts.map((shift: any) => {
                                const tone = roleTone(shift.role)
                                const start =
                                  typeof shift.startTime === 'string'
                                    ? shift.startTime.slice(0, 5)
                                    : shift.startTime
                                return (
                                  <div
                                    key={shift.id}
                                    className="px-2 py-1.5"
                                    style={{
                                      background: tone.bg,
                                      borderRadius: 'var(--pd-radius)',
                                    }}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <p
                                        className="font-semibold truncate text-[11px] leading-tight min-w-0"
                                        style={{ color: 'var(--pd-text)' }}
                                      >
                                        {formatUsername(shift.user.username)}
                                      </p>
                                      {start ? (
                                        <span
                                          className="shrink-0 text-[10px] font-semibold tabular-nums leading-tight"
                                          style={{ color: 'var(--pd-text)' }}
                                        >
                                          {start}
                                        </span>
                                      ) : null}
                                    </div>
                                    <p
                                      className="truncate text-[10px] mt-0.5"
                                      style={{ color: tone.color }}
                                    >
                                      {getRoleName(shift.role)}
                                    </p>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-center py-3 text-xs" style={{ color: 'var(--pd-muted)' }}>
                              —
                            </p>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  )
}

function ShiftSlot({
  label,
  icon: Icon,
  closed,
  holidayName,
  shifts,
  last,
  currentUserId,
}: {
  label: string
  icon: typeof Sun
  closed: boolean
  holidayName?: string
  shifts: any[]
  last?: boolean
  currentUserId?: string
}) {
  return (
    <div style={{ borderBottom: last ? undefined : '1px solid var(--pd-border)' }}>
      <div
        className="px-4 py-2 flex items-center justify-between gap-2"
        style={{ background: 'var(--pd-surface-muted)' }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-wide inline-flex items-center gap-1.5"
          style={{ color: 'var(--pd-muted)' }}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </p>
        {!closed && (
          <p className="text-[11px] tabular-nums" style={{ color: 'var(--pd-muted)' }}>
            {shifts.length === 0
              ? 'Vuoto'
              : `${shifts.length} ${shifts.length === 1 ? 'persona' : 'persone'}`}
          </p>
        )}
      </div>

      {closed ? (
        <div className="px-4 py-3 flex items-center gap-2.5">
          <Ban className="h-4 w-4 shrink-0" style={{ color: 'var(--pd-danger)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--pd-danger)' }}>
              Chiuso
            </p>
            {holidayName ? (
              <p className="text-xs" style={{ color: 'var(--pd-muted)' }}>
                {holidayName}
              </p>
            ) : null}
          </div>
        </div>
      ) : shifts.length > 0 ? (
        <ul className="divide-y" style={{ borderColor: 'var(--pd-border)' }}>
          {shifts.map((shift: any) => {
            const tone = roleTone(shift.role)
            const isMe = Boolean(currentUserId && (shift.userId === currentUserId || shift.user?.id === currentUserId))
            return (
              <li
                key={shift.id}
                className="px-4 py-2.5 flex items-center gap-3"
                style={{
                  background: isMe
                    ? 'color-mix(in srgb, var(--pd-accent-soft) 45%, transparent)'
                    : undefined,
                }}
              >
                <div
                  className="w-8 h-8 shrink-0 flex items-center justify-center text-xs font-semibold"
                  style={{
                    background: tone.bg,
                    color: tone.color,
                    borderRadius: '999px',
                  }}
                >
                  {shift.user.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--pd-text)' }}>
                    {formatUsername(shift.user.username)}
                    {isMe ? (
                      <span className="ml-1.5 text-[10px] font-semibold" style={{ color: 'var(--pd-accent)' }}>
                        tu
                      </span>
                    ) : null}
                  </p>
                  <span
                    className="inline-flex mt-0.5 px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: tone.bg,
                      color: tone.color,
                      borderRadius: 'var(--pd-radius-pill)',
                    }}
                  >
                    {getRoleName(shift.role)}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--pd-text)' }}>
                    {shift.startTime}
                    {shift.endTime ? (
                      <span style={{ color: 'var(--pd-muted)' }}>–{shift.endTime}</span>
                    ) : null}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="px-4 py-2.5 text-xs" style={{ color: 'var(--pd-muted)' }}>
          Nessun turno assegnato
        </p>
      )}
    </div>
  )
}
