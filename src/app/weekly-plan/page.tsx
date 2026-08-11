'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { SectionBlock } from '@/components/ui/section-block'
import { ListRow } from '@/components/ui/list-row'
import { WeekNavigator } from '@/components/ui/week-navigator'
import { Download, Ban } from 'lucide-react'
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
import { getRoleName } from '@/lib/utils'
import { useHaptics } from '@/hooks/use-haptics'

export default function WeeklyPlanPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.roles?.includes('ADMIN') ?? false
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()))
  const [data, setData] = useState<{ schedule: any; holidays: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const { lightClick, mediumClick } = useHaptics()
  const [activeTab, setActiveTab] = useState<'LIST' | 'GRID'>('LIST')

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
          setCurrentWeek(prev =>
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
    setCurrentWeek(prev => addWeekCalendarDays(prev, 7))
  }

  const prevWeek = () => {
    lightClick()
    setCurrentWeek(prev => addWeekCalendarDays(prev, -7))
  }

  const goToToday = () => {
    lightClick()
    setCurrentWeek(getWeekStart(new Date()))
  }

  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
  const shortDays = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM']

  const shiftsByDay: Record<number, Record<string, any[]>> = {}
  if (data?.schedule?.shifts) {
    for (let i = 0; i < 7; i++) {
      shiftsByDay[i] = { PRANZO: [], CENA: [] }
    }
    data.schedule.shifts.forEach((shift: any) => {
      shiftsByDay[shift.dayOfWeek][shift.shiftType].push(shift)
    })
  }

  const isToday = (dayIndex: number) =>
    utcCalendarDateKey(addWeekCalendarDays(currentWeek, dayIndex)) === appTodayCalendarDateKey()

  const holidaysForDay = (dayIndex: number) => {
    if (!data?.holidays?.length) return []
    const slotKey = utcCalendarDateKey(addWeekCalendarDays(currentWeek, dayIndex))
    return data.holidays.filter(
      h => utcCalendarDateKey(normalizeDate(h.date)) === slotKey
    )
  }

  return (
    <MainLayout contentWidth="6xl" title="Piano settimanale" subtitle="Turni di tutta la squadra">
      <div className="pd-page pb-20">
        <PageHeader
          title="Piano settimanale"
          subtitle="Consulta i turni di tutta la squadra"
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
            }}
          >
            {(['LIST', 'GRID'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  lightClick()
                  setActiveTab(tab)
                }}
                className="px-3.5 py-1.5 text-xs font-semibold pd-press"
                style={{
                  borderRadius: 'var(--pd-radius-pill)',
                  background: activeTab === tab ? 'var(--pd-surface)' : 'transparent',
                  color: activeTab === tab ? 'var(--pd-text)' : 'var(--pd-muted)',
                  boxShadow: activeTab === tab ? 'var(--pd-shadow)' : undefined,
                }}
              >
                {tab === 'LIST' ? 'Lista' : 'Griglia'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--pd-muted)' }}>
            Caricamento piano…
          </div>
        ) : activeTab === 'LIST' ? (
          <div className="space-y-6">
            {days.map((dayName, index) => {
              const dayHolidays = holidaysForDay(index)
              const date = addWeekCalendarDays(currentWeek, index)
              const dayIsToday = isToday(index)
              const pranzoShifts = shiftsByDay[index]?.PRANZO || []
              const cenaShifts = shiftsByDay[index]?.CENA || []

              const isFullClosure = dayHolidays.some(h => h.closureType === 'FULL_DAY')
              const isPranzoClosure =
                isFullClosure || dayHolidays.some(h => h.closureType === 'PRANZO_ONLY')
              const isCenaClosure =
                isFullClosure || dayHolidays.some(h => h.closureType === 'CENA_ONLY')

              const holidayHint = dayHolidays
                .map(h => h.description)
                .filter(Boolean)
                .join(' · ')

              return (
                <SectionBlock
                  key={index}
                  title={`${dayName} ${date.getUTCDate()}`}
                  subtitle={
                    dayIsToday
                      ? `Oggi · ${formatMonthYearIt(date)}`
                      : holidayHint
                        ? `${formatMonthYearIt(date)} · ${holidayHint}`
                        : formatMonthYearIt(date)
                  }
                  card
                >
                  <ShiftSlot
                    label="Pranzo"
                    closed={isPranzoClosure}
                    holidayName={holidayHint || undefined}
                    shifts={pranzoShifts}
                  />
                  <ShiftSlot
                    label="Cena"
                    closed={isCenaClosure}
                    holidayName={holidayHint || undefined}
                    shifts={cenaShifts}
                  />
                </SectionBlock>
              )
            })}
          </div>
        ) : (
          <div className="pd-card overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--pd-border)' }}>
                  <th
                    className="px-3 py-3 text-left text-xs font-semibold sticky left-0"
                    style={{ color: 'var(--pd-muted)', background: 'var(--pd-surface)' }}
                  >
                    Turno
                  </th>
                  {days.map((_, idx) => {
                    const date = addWeekCalendarDays(currentWeek, idx)
                    const dayIsToday = isToday(idx)
                    const gridHolidays = holidaysForDay(idx)
                    return (
                      <th
                        key={idx}
                        className="px-2 py-3 text-center min-w-[88px]"
                        style={{
                          background: dayIsToday ? 'var(--pd-accent-soft)' : 'var(--pd-surface)',
                        }}
                      >
                        <p
                          className="text-[11px] font-semibold"
                          style={{ color: dayIsToday ? 'var(--pd-accent)' : 'var(--pd-muted)' }}
                        >
                          {shortDays[idx]}
                        </p>
                        <p
                          className="pd-display text-lg font-semibold tabular-nums"
                          style={{ color: dayIsToday ? 'var(--pd-accent)' : 'var(--pd-text)' }}
                        >
                          {date.getUTCDate()}
                        </p>
                        {gridHolidays.length > 0 && (
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--pd-warning)' }}>
                            Festa
                          </p>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {(['PRANZO', 'CENA'] as const).map(shiftType => (
                  <tr key={shiftType} style={{ borderBottom: '1px solid var(--pd-border)' }}>
                    <td
                      className="px-3 py-3 text-xs font-semibold sticky left-0 align-top"
                      style={{ color: 'var(--pd-text)', background: 'var(--pd-surface)' }}
                    >
                      {shiftType === 'PRANZO' ? 'Pranzo' : 'Cena'}
                    </td>
                    {days.map((_, idx) => {
                      const gh = holidaysForDay(idx)
                      const isFullClosure = gh.some(h => h.closureType === 'FULL_DAY')
                      const isClosed =
                        isFullClosure ||
                        gh.some(h =>
                          shiftType === 'PRANZO'
                            ? h.closureType === 'PRANZO_ONLY'
                            : h.closureType === 'CENA_ONLY'
                        )
                      const slotShifts = shiftsByDay[idx]?.[shiftType] || []
                      const dayIsToday = isToday(idx)

                      return (
                        <td
                          key={idx}
                          className="px-1.5 py-2 align-top min-h-[100px]"
                          style={{
                            background: dayIsToday
                              ? 'color-mix(in srgb, var(--pd-accent-soft) 50%, transparent)'
                              : undefined,
                          }}
                        >
                          {isClosed ? (
                            <p className="text-[11px] text-center py-4" style={{ color: 'var(--pd-danger)' }}>
                              Chiuso
                            </p>
                          ) : slotShifts.length > 0 ? (
                            <div className="space-y-1">
                              {slotShifts.map((shift: any) => (
                                <div
                                  key={shift.id}
                                  className="px-2 py-1.5 text-[11px]"
                                  style={{
                                    background: 'var(--pd-surface-muted)',
                                    borderRadius: 'var(--pd-radius)',
                                  }}
                                >
                                  <p className="font-semibold truncate" style={{ color: 'var(--pd-text)' }}>
                                    {shift.user.username.split('.')[0]}
                                  </p>
                                  <p className="truncate" style={{ color: 'var(--pd-muted)' }}>
                                    {getRoleName(shift.role)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-center py-4 text-xs" style={{ color: 'var(--pd-muted)' }}>
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
  closed,
  holidayName,
  shifts,
}: {
  label: string
  closed: boolean
  holidayName?: string
  shifts: any[]
}) {
  return (
    <div>
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{
          background: 'var(--pd-surface-muted)',
          borderBottom: '1px solid var(--pd-border)',
        }}
      >
        <p className="text-xs font-semibold" style={{ color: 'var(--pd-muted)' }}>
          {label}
        </p>
        {!closed && shifts.length > 0 && (
          <p className="text-[11px]" style={{ color: 'var(--pd-muted)' }}>
            {shifts.length} {shifts.length === 1 ? 'persona' : 'persone'}
          </p>
        )}
      </div>
      {closed ? (
        <div className="px-4 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--pd-border)' }}>
          <Ban className="h-4 w-4 shrink-0" style={{ color: 'var(--pd-danger)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--pd-danger)' }}>
              Chiuso
            </p>
            {holidayName && (
              <p className="text-xs" style={{ color: 'var(--pd-muted)' }}>
                {holidayName}
              </p>
            )}
          </div>
        </div>
      ) : shifts.length > 0 ? (
        shifts.map((shift: any) => (
          <ListRow
            key={shift.id}
            title={shift.user.username}
            subtitle={getRoleName(shift.role)}
            meta={shift.startTime}
            leading={
              <div
                className="w-8 h-8 flex items-center justify-center text-xs font-semibold"
                style={{
                  background: 'var(--pd-accent-soft)',
                  color: 'var(--pd-accent)',
                  borderRadius: 'var(--pd-radius)',
                }}
              >
                {shift.user.username.charAt(0).toUpperCase()}
              </div>
            }
          />
        ))
      ) : (
        <p className="py-2 px-4 text-xs" style={{ color: 'var(--pd-muted)' }}>
          Nessun turno
        </p>
      )}
    </div>
  )
}
