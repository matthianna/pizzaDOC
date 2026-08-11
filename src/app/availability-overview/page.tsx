'use client'

import React, { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { StatStrip } from '@/components/ui/stat-strip'
import { WeekNavigator } from '@/components/ui/week-navigator'
import { EmptyState } from '@/components/ui/list-row'
import { Users, Check, X, Ban } from 'lucide-react'
import { addWeeks, subWeeks } from 'date-fns'
import { getRoleName } from '@/lib/utils'
import { getWeekStart, addWeekCalendarDays, formatDate } from '@/lib/date-utils'

interface UserAvailability {
  userId: string
  username: string
  primaryRole: string
  availabilities: {
    dayOfWeek: number
    shiftType: 'PRANZO' | 'CENA'
    isAvailable: boolean
  }[]
  absences: {
    id: string
    startDate: string
    endDate: string
    reason: string | null
  }[]
}

interface OverviewHoliday {
  date: string
  closureType: 'FULL_DAY' | 'PRANZO_ONLY' | 'CENA_ONLY'
  description: string | null
}

function utcDayKeyFromWeekIndex(weekStart: Date, dayIdx: number): string {
  return addWeekCalendarDays(weekStart, dayIdx).toISOString().slice(0, 10)
}

function holidayBlocksOverviewSlot(
  holidays: OverviewHoliday[],
  weekStart: Date,
  dayIdx: number,
  shiftType: 'PRANZO' | 'CENA'
): OverviewHoliday | null {
  const dayKey = utcDayKeyFromWeekIndex(weekStart, dayIdx)
  return (
    holidays.find(h => {
      const hk = new Date(h.date).toISOString().slice(0, 10)
      if (hk !== dayKey) return false
      if (h.closureType === 'FULL_DAY') return true
      if (h.closureType === 'PRANZO_ONLY' && shiftType === 'PRANZO') return true
      if (h.closureType === 'CENA_ONLY' && shiftType === 'CENA') return true
      return false
    }) ?? null
  )
}

function AvailabilitySlotCell({
  holiday,
  isAbsent,
  isAvailable,
}: {
  holiday: OverviewHoliday | null
  isAbsent: boolean
  isAvailable?: boolean
}) {
  if (holiday) {
    return (
      <div
        className="flex flex-col items-center justify-center py-1"
        title={holiday.description || 'Locale chiuso / festivo'}
      >
        <Ban className="h-3.5 w-3.5" style={{ color: 'var(--pd-warning)' }} />
        <span className="text-[9px] font-medium mt-0.5" style={{ color: 'var(--pd-warning)' }}>
          Chiuso
        </span>
      </div>
    )
  }

  if (isAbsent) {
    return (
      <div className="flex items-center justify-center py-1" title="Assente">
        <span className="text-[10px] font-semibold" style={{ color: 'var(--pd-danger)' }}>
          ABS
        </span>
      </div>
    )
  }

  if (isAvailable) {
    return (
      <div className="flex items-center justify-center py-1">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: 'var(--pd-success)' }}
        >
          <Check className="h-3 w-3" style={{ color: 'var(--pd-accent-fg)' }} strokeWidth={3} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-1 opacity-30">
      <X className="h-3.5 w-3.5" style={{ color: 'var(--pd-muted)' }} />
    </div>
  )
}

export default function AvailabilityOverviewPage() {
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()))
  const [usersAvailability, setUsersAvailability] = useState<UserAvailability[]>([])
  const [weekHolidays, setWeekHolidays] = useState<OverviewHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRole, setSelectedRole] = useState<string>('ALL')

  useEffect(() => {
    fetchAvailability()
  }, [currentWeek])

  const fetchAvailability = async () => {
    setLoading(true)
    try {
      const timestamp = new Date().getTime()
      const response = await fetch(
        `/api/availability-overview?weekStart=${currentWeek.toISOString()}&_t=${timestamp}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        }
      )
      if (response.ok) {
        const data = await response.json()
        setUsersAvailability(data.users)
        setWeekHolidays(data.holidays ?? [])
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
    } finally {
      setLoading(false)
    }
  }

  const goToPreviousWeek = () => {
    setCurrentWeek(prev => getWeekStart(subWeeks(prev, 1)))
  }

  const goToNextWeek = () => {
    setCurrentWeek(prev => getWeekStart(addWeeks(prev, 1)))
  }

  const goToCurrentWeek = () => {
    setCurrentWeek(getWeekStart(new Date()))
  }

  const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

  const filteredUsers =
    selectedRole === 'ALL'
      ? usersAvailability
      : usersAvailability.filter(u => u.primaryRole === selectedRole)

  const totalAvailabilities = filteredUsers.reduce((sum, user) => {
    return (
      sum +
      user.availabilities.filter(a => {
        if (!a.isAvailable) return false
        const h = holidayBlocksOverviewSlot(weekHolidays, currentWeek, a.dayOfWeek, a.shiftType)
        return !h
      }).length
    )
  }, 0)

  const totalSlots = filteredUsers.length * 7 * 2
  const availabilityPercentage = totalSlots > 0 ? (totalAvailabilities / totalSlots) * 100 : 0

  return (
    <MainLayout contentWidth="6xl" title="Disponibilità" subtitle="Panoramica squadra">
      <div className="pd-page pb-20">
        <PageHeader
          title="Disponibilità utenti"
          subtitle="Panoramica settimanale di tutta la squadra"
          action={
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              className="text-sm font-semibold px-3 py-2"
              style={{
                background: 'var(--pd-surface)',
                border: '1px solid var(--pd-border)',
                borderRadius: 'var(--pd-radius-pill)',
                color: 'var(--pd-text)',
              }}
            >
              <option value="ALL">Tutti i ruoli</option>
              <option value="FATTORINO">Fattorini</option>
              <option value="CUCINA">Cucina</option>
              <option value="SALA">Sala</option>
              <option value="PIZZAIOLO">Pizzaioli</option>
            </select>
          }
        />

        <WeekNavigator
          label={`${formatDate(currentWeek)} – ${formatDate(addWeekCalendarDays(currentWeek, 6))}`}
          onPrev={goToPreviousWeek}
          onNext={goToNextWeek}
          onToday={goToCurrentWeek}
          disabled={loading}
        />

        <StatStrip
          items={[
            { label: 'Personale', value: filteredUsers.length },
            { label: 'Slot coperti', value: totalAvailabilities },
            { label: 'Copertura', value: `${availabilityPercentage.toFixed(0)}%` },
          ]}
        />

        <div className="pd-card overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--pd-muted)' }}>
              Caricamento…
            </div>
          ) : filteredUsers.length === 0 ? (
            <EmptyState title="Nessun membro trovato" icon={<Users className="h-8 w-8" />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--pd-border)' }}>
                    <th
                      className="sticky left-0 z-20 px-4 py-3 text-left text-xs font-semibold min-w-[140px]"
                      style={{
                        color: 'var(--pd-muted)',
                        background: 'var(--pd-surface)',
                        borderRight: '1px solid var(--pd-border)',
                      }}
                    >
                      Membro
                    </th>
                    {days.map((day, idx) => {
                      const dayKey = utcDayKeyFromWeekIndex(currentWeek, idx)
                      const onDay = weekHolidays.filter(
                        h => new Date(h.date).toISOString().slice(0, 10) === dayKey
                      )
                      const fullDay = onDay.some(h => h.closureType === 'FULL_DAY')
                      return (
                        <th
                          key={idx}
                          colSpan={2}
                          className="px-1 py-3 text-center text-[11px] font-semibold"
                          style={{
                            color: fullDay ? 'var(--pd-warning)' : 'var(--pd-muted)',
                            background: fullDay ? 'var(--pd-accent-soft)' : undefined,
                          }}
                        >
                          {day}
                          {fullDay && <span className="block text-[9px] font-medium">Chiuso</span>}
                        </th>
                      )
                    })}
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--pd-border)' }}>
                    <th
                      className="sticky left-0 z-20"
                      style={{
                        background: 'var(--pd-surface)',
                        borderRight: '1px solid var(--pd-border)',
                      }}
                    />
                    {days.map((_, dayIdx) => (
                      <React.Fragment key={dayIdx}>
                        <th
                          className="px-0.5 py-1.5 text-center text-[9px] font-medium"
                          style={{ color: 'var(--pd-muted)' }}
                        >
                          P
                        </th>
                        <th
                          className="px-0.5 py-1.5 text-center text-[9px] font-medium"
                          style={{ color: 'var(--pd-muted)' }}
                        >
                          C
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => {
                    const isAbsentOnDay = (dayIdx: number): boolean => {
                      const dayDate = addWeekCalendarDays(currentWeek, dayIdx)
                      const dNorm = Date.UTC(
                        dayDate.getUTCFullYear(),
                        dayDate.getUTCMonth(),
                        dayDate.getUTCDate()
                      )
                      return user.absences.some(abs => {
                        const s = new Date(abs.startDate)
                        const e = new Date(abs.endDate)
                        const sNorm = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate())
                        const eNorm = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate())
                        return dNorm >= sNorm && dNorm <= eNorm
                      })
                    }

                    return (
                      <tr
                        key={user.userId}
                        style={{ borderBottom: '1px solid var(--pd-border)' }}
                      >
                        <td
                          className="sticky left-0 z-10 px-4 py-3 whitespace-nowrap"
                          style={{
                            background: 'var(--pd-surface)',
                            borderRight: '1px solid var(--pd-border)',
                          }}
                        >
                          <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                            {user.username}
                          </p>
                          <p className="text-[11px]" style={{ color: 'var(--pd-muted)' }}>
                            {getRoleName(user.primaryRole as any)}
                          </p>
                        </td>
                        {days.map((_, dayIdx) => {
                          const pranzoAvail = user.availabilities.find(
                            a => a.dayOfWeek === dayIdx && a.shiftType === 'PRANZO'
                          )
                          const cenaAvail = user.availabilities.find(
                            a => a.dayOfWeek === dayIdx && a.shiftType === 'CENA'
                          )
                          const isAbsent = isAbsentOnDay(dayIdx)
                          const hPranzo = holidayBlocksOverviewSlot(
                            weekHolidays,
                            currentWeek,
                            dayIdx,
                            'PRANZO'
                          )
                          const hCena = holidayBlocksOverviewSlot(
                            weekHolidays,
                            currentWeek,
                            dayIdx,
                            'CENA'
                          )

                          return (
                            <React.Fragment key={`${user.userId}-${dayIdx}`}>
                              <td className="px-1 py-2 text-center">
                                <AvailabilitySlotCell
                                  holiday={hPranzo}
                                  isAbsent={isAbsent}
                                  isAvailable={pranzoAvail?.isAvailable}
                                />
                              </td>
                              <td className="px-1 py-2 text-center">
                                <AvailabilitySlotCell
                                  holiday={hCena}
                                  isAbsent={isAbsent}
                                  isAvailable={cenaAvail?.isAvailable}
                                />
                              </td>
                            </React.Fragment>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-xs px-1" style={{ color: 'var(--pd-muted)' }}>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-4 h-4 rounded-full inline-flex items-center justify-center"
              style={{ background: 'var(--pd-success)' }}
            >
              <Check className="h-2.5 w-2.5" style={{ color: 'var(--pd-accent-fg)' }} strokeWidth={3} />
            </span>
            Disponibile
          </span>
          <span className="inline-flex items-center gap-1.5">
            <X className="h-3.5 w-3.5 opacity-40" /> Non disponibile
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span style={{ color: 'var(--pd-danger)' }} className="font-semibold">
              ABS
            </span>{' '}
            Assente
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Ban className="h-3.5 w-3.5" style={{ color: 'var(--pd-warning)' }} /> Chiusura / festivo
          </span>
        </div>
      </div>
    </MainLayout>
  )
}
