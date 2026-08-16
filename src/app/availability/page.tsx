'use client'

import { useState, useEffect, useMemo } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { useSession } from 'next-auth/react'
import { Save, AlertCircle, Lock, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getNextWeekStart,
  canEditAvailability,
  canEditAvailabilityDay,
  getWeekDays,
  formatDate,
  getDayOfWeek,
  addWeekCalendarDays,
} from '@/lib/date-utils'
import { getDayName, cn, isPriorityUser } from '@/lib/utils'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useHaptics } from '@/hooks/use-haptics'
import { useToast } from '@/components/ui/toast'
import { WeekNavigator } from '@/components/ui/week-navigator'
import { EmptyState } from '@/components/ui/list-row'

interface Availability {
  dayOfWeek: number
  shiftType: 'PRANZO' | 'CENA'
  isAvailable: boolean
}

interface Holiday {
  id: string
  date: string
  closureType: 'FULL_DAY' | 'PRANZO_ONLY' | 'CENA_ONLY'
  description: string | null
}

export default function AvailabilityPage() {
  const { data: session } = useSession()
  const [currentWeek, setCurrentWeek] = useState(getNextWeekStart())
  const [availabilities, setAvailabilities] = useState<Availability[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [disabledDays, setDisabledDays] = useState<number[]>([])
  const [absenceInfo, setAbsenceInfo] = useState<
    { startDate: string; endDate: string; reason: string | null }[]
  >([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const { lightClick, success } = useHaptics()
  const { showToast, ToastContainer } = useToast()

  const isUserPriority = session?.user.username ? isPriorityUser(session.user.username) : false
  const isAdmin = session?.user.roles.includes('ADMIN') && !isUserPriority

  useEffect(() => {
    fetchAvailability()
    fetchAbsences()
    fetchHolidays()
  }, [currentWeek])

  const fetchAvailability = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/availability?weekStart=${currentWeek.toISOString()}`)
      if (response.ok) {
        const data = await response.json()
        setAvailabilities(
          data.map((d: any) => ({
            dayOfWeek: d.dayOfWeek,
            shiftType: d.shiftType,
            isAvailable: d.isAvailable,
          }))
        )
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAbsences = async () => {
    try {
      const response = await fetch(
        `/api/user/absences/check-week?weekStart=${currentWeek.toISOString()}`
      )
      if (response.ok) {
        const data = await response.json()
        setDisabledDays(data.disabledDays || [])
        setAbsenceInfo(data.absences || [])
      }
    } catch (error) {
      console.error('Error fetching absences:', error)
    }
  }

  const fetchHolidays = async () => {
    try {
      const weekDays = getWeekDays(currentWeek)
      const startDate = weekDays[0].toISOString().split('T')[0]
      const endDate = weekDays[6].toISOString().split('T')[0]
      const response = await fetch(`/api/holidays?startDate=${startDate}&endDate=${endDate}`)
      if (response.ok) {
        const data = await response.json()
        setHolidays(data)
      }
    } catch (error) {
      console.error('Error fetching holidays:', error)
    }
  }

  /** Use the row's calendar day (not dayOfWeek index) so it stays correct with UTC week dates. */
  const holidayForSlot = (calendarDay: Date, shiftType: 'PRANZO' | 'CENA'): Holiday | null => {
    const dayDate = calendarDay.toISOString().split('T')[0]
    const holiday = holidays.find((h) => {
      const holidayDate = new Date(h.date).toISOString().split('T')[0]
      if (holidayDate !== dayDate) return false
      if (h.closureType === 'FULL_DAY') return true
      if (h.closureType === 'PRANZO_ONLY' && shiftType === 'PRANZO') return true
      if (h.closureType === 'CENA_ONLY' && shiftType === 'CENA') return true
      return false
    })
    return holiday || null
  }

  const fullDayHoliday = (calendarDay: Date): Holiday | null => {
    const dayDate = calendarDay.toISOString().split('T')[0]
    return (
      holidays.find((h) => {
        const holidayDate = new Date(h.date).toISOString().split('T')[0]
        return holidayDate === dayDate && h.closureType === 'FULL_DAY'
      }) || null
    )
  }

  const saveAvailability = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: currentWeek.toISOString(),
          availabilities,
        }),
      })
      if (response.ok) {
        success()
        showToast('Disponibilità salvata con successo!', 'success')
      } else {
        const data = await response.json().catch(() => null)
        showToast(data?.error || 'Errore durante il salvataggio', 'error')
      }
    } catch (error) {
      console.error('Error saving availability:', error)
      showToast('Errore durante il salvataggio', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleAvailability = (
    calendarDay: Date,
    dayOfWeek: number,
    shiftType: 'PRANZO' | 'CENA'
  ) => {
    if (!canEditAvailability(currentWeek) || !canEditAvailabilityDay(calendarDay)) return
    if (disabledDays.includes(dayOfWeek)) return
    if (holidayForSlot(calendarDay, shiftType)) return

    lightClick()
    const existing = availabilities.find(
      (a) => a.dayOfWeek === dayOfWeek && a.shiftType === shiftType
    )
    if (existing) {
      setAvailabilities(
        availabilities.map((a) =>
          a.dayOfWeek === dayOfWeek && a.shiftType === shiftType
            ? { ...a, isAvailable: !a.isAvailable }
            : a
        )
      )
    } else {
      setAvailabilities([...availabilities, { dayOfWeek, shiftType, isAvailable: true }])
    }
  }

  const isDayDisabled = (dayOfWeek: number) => disabledDays.includes(dayOfWeek)

  const isAvailable = (dayOfWeek: number, shiftType: 'PRANZO' | 'CENA') => {
    return (
      availabilities.find((a) => a.dayOfWeek === dayOfWeek && a.shiftType === shiftType)
        ?.isAvailable || false
    )
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(addWeekCalendarDays(currentWeek, direction === 'next' ? 7 : -7))
  }

  const weekDays = getWeekDays(currentWeek)
  const canEditWeek = canEditAvailability(currentWeek)
  const canEditDay = (day: Date) => canEditWeek && canEditAvailabilityDay(day)
  const canEditAnyDay = canEditWeek && weekDays.some((day) => canEditAvailabilityDay(day))

  const availableCount = useMemo(
    () => availabilities.filter((a) => a.isAvailable).length,
    [availabilities]
  )

  const weekLabel = `${formatDate(weekDays[0])} – ${formatDate(weekDays[6])}`
  const weekHint = !canEditAnyDay
    ? 'Sola lettura'
    : `${availableCount} slot disponibili`

  if (isAdmin) {
    return (
      <MainLayout contentWidth="4xl" title="Disponibilità">
        <div className="pd-page">
          <EmptyState
            title="Accesso limitato"
            description="La gestione delle disponibilità è riservata ai dipendenti."
            icon={<Lock className="h-10 w-10" style={{ color: 'var(--pd-muted)' }} />}
          />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout contentWidth="4xl">
      <div className="pd-page pb-28 lg:pb-8">
        <PageHeader
          title="Disponibilità"
          subtitle="Indica i turni in cui puoi lavorare"
        />

        <WeekNavigator
          label={weekLabel}
          hint={weekHint}
          onPrev={() => navigateWeek('prev')}
          onNext={() => navigateWeek('next')}
          disabled={loading}
        />

        {!canEditWeek && (
          <div
            className="px-4 py-3 flex items-start gap-3"
            style={{
              background: 'var(--pd-surface-muted)',
              border: '1px solid var(--pd-border)',
              borderRadius: 'var(--pd-radius-lg)',
            }}
          >
            <Lock className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--pd-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--pd-text)' }}>
              La disponibilità di questa settimana non è più modificabile.
            </p>
          </div>
        )}

        {absenceInfo.length > 0 && (
          <div
            className="px-4 py-3 flex items-start gap-3"
            style={{
              background: 'var(--pd-danger-soft)',
              border: '1px solid color-mix(in srgb, var(--pd-danger) 20%, transparent)',
              borderRadius: 'var(--pd-radius-lg)',
            }}
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--pd-danger)' }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--pd-danger)' }}>
                Assenze programmate
              </p>
              {absenceInfo.map((a, i) => (
                <p key={i} className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                  {format(new Date(a.startDate), 'dd/MM', { locale: it })} –{' '}
                  {format(new Date(a.endDate), 'dd/MM', { locale: it })}
                  {a.reason ? ` · ${a.reason}` : ''}
                </p>
              ))}
            </div>
          </div>
        )}

        <ul className="space-y-2">
          {weekDays.map((day, index) => {
            const dayOfWeek = getDayOfWeek(day)
            const dayDisabled = isDayDisabled(dayOfWeek)
            const fullHoliday = fullDayHoliday(day)
            const pranzoHoliday = holidayForSlot(day, 'PRANZO')
            const cenaHoliday = holidayForSlot(day, 'CENA')
            const closedFull = !!fullHoliday || dayDisabled
            const dayEditable = canEditDay(day) && !loading

            return (
              <li
                key={index}
                className="p-3 sm:p-4"
                style={{
                  background: 'var(--pd-surface)',
                  border: '1px solid var(--pd-border)',
                  borderRadius: 'var(--pd-radius-lg)',
                  opacity: closedFull ? 0.72 : 1,
                }}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                      {getDayName(dayOfWeek)}{' '}
                      <span className="font-medium" style={{ color: 'var(--pd-muted)' }}>
                        {format(day, 'd MMM', { locale: it })}
                      </span>
                    </p>
                    {fullHoliday && (
                      <p
                        className="text-[11px] font-semibold mt-0.5 inline-flex items-center gap-1"
                        style={{ color: 'var(--pd-warning)' }}
                      >
                        <Ban className="h-3 w-3" />
                        Chiusura totale
                        {fullHoliday.description ? ` · ${fullHoliday.description}` : ''}
                      </p>
                    )}
                    {!fullHoliday && dayDisabled && (
                      <p
                        className="text-[11px] font-semibold mt-0.5 inline-flex items-center gap-1"
                        style={{ color: 'var(--pd-danger)' }}
                      >
                        <Ban className="h-3 w-3" />
                        Assente
                      </p>
                    )}
                    {!fullHoliday && pranzoHoliday && !cenaHoliday && (
                      <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--pd-warning)' }}>
                        Pranzo chiuso
                      </p>
                    )}
                    {!fullHoliday && cenaHoliday && !pranzoHoliday && (
                      <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--pd-warning)' }}>
                        Cena chiusa
                      </p>
                    )}
                  </div>
                  {(dayDisabled || (!canEditAnyDay && !dayEditable)) && (
                    <Lock className="h-4 w-4 shrink-0" style={{ color: 'var(--pd-muted)' }} />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ShiftToggle
                    label="Pranzo"
                    active={isAvailable(dayOfWeek, 'PRANZO')}
                    disabled={closedFull || !!pranzoHoliday || !dayEditable}
                    onClick={() => toggleAvailability(day, dayOfWeek, 'PRANZO')}
                  />
                  <ShiftToggle
                    label="Cena"
                    active={isAvailable(dayOfWeek, 'CENA')}
                    disabled={closedFull || !!cenaHoliday || !dayEditable}
                    onClick={() => toggleAvailability(day, dayOfWeek, 'CENA')}
                  />
                </div>
              </li>
            )
          })}
        </ul>

        {canEditAnyDay && (
          <div className="pd-sticky-save">
            <Button
              onClick={saveAvailability}
              disabled={saving || loading}
              isLoading={saving}
              className="w-full py-4 pd-btn-primary"
            >
              {saving ? (
                'Salvataggio...'
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Salva disponibilità
                </>
              )}
            </Button>
          </div>
        )}
      </div>
      <ToastContainer />
    </MainLayout>
  )
}

function ShiftToggle({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'py-3.5 text-sm font-semibold transition-colors pd-press',
        disabled && 'cursor-not-allowed opacity-50'
      )}
      style={{
        background: active ? 'var(--pd-success-soft)' : 'var(--pd-surface-muted)',
        color: active ? 'var(--pd-success)' : 'var(--pd-muted)',
        border: active
          ? '1.5px solid color-mix(in srgb, var(--pd-success) 45%, transparent)'
          : '1.5px solid transparent',
        borderRadius: 'var(--pd-radius)',
      }}
    >
      {disabled && !active ? label : active ? `${label} · OK` : `${label} · No`}
    </button>
  )
}
