'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { StaffPageHeader } from '@/components/layout/staff-page-header'
import { useSession } from 'next-auth/react'
import { Calendar, ChevronLeft, ChevronRight, Save, AlertCircle, Lock, CheckCircle, Sparkles, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getNextWeekStart, canEditAvailability, canEditAvailabilityDay, getWeekDays, formatDate, getDayOfWeek, getShiftTimes, addWeekCalendarDays } from '@/lib/date-utils'
import { getDayName, getShiftTypeName } from '@/lib/utils'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useHaptics } from '@/hooks/use-haptics'
import { useToast } from '@/components/ui/toast'
import { isPriorityUser } from '@/lib/utils'
import type { Role } from '@prisma/client'

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
  const [absenceInfo, setAbsenceInfo] = useState<{ startDate: string, endDate: string, reason: string | null }[]>([])
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
        setAvailabilities(data.map((d: any) => ({
          dayOfWeek: d.dayOfWeek,
          shiftType: d.shiftType,
          isAvailable: d.isAvailable
        })))
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAbsences = async () => {
    try {
      const response = await fetch(`/api/user/absences/check-week?weekStart=${currentWeek.toISOString()}`)
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
    const holiday = holidays.find(h => {
      const holidayDate = new Date(h.date).toISOString().split('T')[0]
      if (holidayDate !== dayDate) return false
      if (h.closureType === 'FULL_DAY') return true
      if (h.closureType === 'PRANZO_ONLY' && shiftType === 'PRANZO') return true
      if (h.closureType === 'CENA_ONLY' && shiftType === 'CENA') return true
      return false
    })
    return holiday || null
  }

  const saveAvailability = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: currentWeek.toISOString(),
          availabilities
        })
      })
      if (response.ok) {
        success()
        showToast('Disponibilità salvata con successo!', 'success')
      } else {
        showToast('Errore durante il salvataggio', 'error')
      }
    } catch (error) {
      console.error('Error saving availability:', error)
      showToast('Errore durante il salvataggio', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleAvailability = (calendarDay: Date, dayOfWeek: number, shiftType: 'PRANZO' | 'CENA') => {
    if (!canEditAvailability(currentWeek) || !canEditAvailabilityDay(calendarDay)) return
    if (disabledDays.includes(dayOfWeek)) return
    if (holidayForSlot(calendarDay, shiftType)) return

    lightClick()
    const existing = availabilities.find(a => a.dayOfWeek === dayOfWeek && a.shiftType === shiftType)
    if (existing) {
      setAvailabilities(availabilities.map(a =>
        a.dayOfWeek === dayOfWeek && a.shiftType === shiftType
          ? { ...a, isAvailable: !a.isAvailable }
          : a
      ))
    } else {
      setAvailabilities([...availabilities, { dayOfWeek, shiftType, isAvailable: true }])
    }
  }

  const isDayDisabled = (dayOfWeek: number) => disabledDays.includes(dayOfWeek)

  const isAvailable = (dayOfWeek: number, shiftType: 'PRANZO' | 'CENA') => {
    return availabilities.find(a => a.dayOfWeek === dayOfWeek && a.shiftType === shiftType)?.isAvailable || false
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(addWeekCalendarDays(currentWeek, direction === 'next' ? 7 : -7))
  }

  const weekDays = getWeekDays(currentWeek)
  const canEditWeek = canEditAvailability(currentWeek)
  const canEditDay = (day: Date) => canEditWeek && canEditAvailabilityDay(day)
  const canEditAnyDay = canEditWeek && weekDays.some(canEditAvailabilityDay)

  if (isAdmin) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center max-w-md">
            <Lock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Accesso Limitato</h2>
            <p className="text-gray-600">La gestione delle disponibilità è riservata ai dipendenti.</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <StaffPageHeader
          title="Disponibilità"
          subtitle="Indica i turni in cui puoi lavorare"
        />

        <div className="pd-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <button type="button" onClick={() => navigateWeek('prev')} className="p-3 pd-press" style={{ borderRadius: 'var(--pd-radius)', color: 'var(--pd-text)' }}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <h2 className="pd-display text-base sm:text-lg font-semibold leading-tight">
                {formatDate(weekDays[0])} – {formatDate(weekDays[6])}
              </h2>
              {!canEditAnyDay && (
                <div className="flex items-center justify-center mt-1 text-sm font-medium" style={{ color: 'var(--pd-accent)' }}>
                  <Lock className="h-3 w-3 mr-1" />
                  <span>Sola lettura</span>
                </div>
              )}
            </div>
            <button type="button" onClick={() => navigateWeek('next')} className="p-3 pd-press" style={{ borderRadius: 'var(--pd-radius)', color: 'var(--pd-text)' }}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {absenceInfo.length > 0 && (
            <div className="mb-6 rounded-2xl p-4 border" style={{ background: 'var(--pd-danger-soft)', borderColor: 'var(--pd-border)' }}>
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--pd-danger)' }} />
                <div>
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--pd-danger)' }}>Assenze programmate</h4>
                  {absenceInfo.map((a, i) => (
                    <p key={i} className="text-xs text-red-700 font-medium">
                      {format(new Date(a.startDate), 'dd/MM')} - {format(new Date(a.endDate), 'dd/MM')} {a.reason && `(${a.reason})`}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Availability Grid */}
          <div className="space-y-4">
            <div className="block sm:hidden space-y-4">
              {weekDays.map((day, index) => {
                const dayOfWeek = getDayOfWeek(day)
                const dayDisabled = isDayDisabled(dayOfWeek)
                const pranzoHoliday = holidayForSlot(day, 'PRANZO')
                const cenaHoliday = holidayForSlot(day, 'CENA')

                return (
                  <div key={index} className="pd-card p-5 transition-all" style={{ opacity: dayDisabled ? 0.85 : 1 }}>
                    <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: 'var(--pd-border)' }}>
                      <div>
                        <span className="font-semibold text-lg tracking-tight" style={{ color: dayDisabled ? 'var(--pd-danger)' : 'var(--pd-text)' }}>
                          {getDayName(dayOfWeek)}
                        </span>
                        <p className="text-xs font-medium" style={{ color: 'var(--pd-muted)' }}>{formatDate(day)}</p>
                      </div>
                      {dayDisabled && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'var(--pd-danger-soft)', color: 'var(--pd-danger)' }}>
                          <Ban className="h-3 w-3" /> Assente
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <ShiftToggle
                        label="Pranzo"
                        times={`${getShiftTimes('PRANZO').start} - ${getShiftTimes('PRANZO').end}`}
                        isActive={isAvailable(dayOfWeek, 'PRANZO')}
                        isDisabled={dayDisabled}
                        holiday={pranzoHoliday}
                        onToggle={() => toggleAvailability(day, dayOfWeek, 'PRANZO')}
                        canEdit={canEditDay(day) && !loading}
                      />
                      <ShiftToggle
                        label="Cena"
                        times={`${getShiftTimes('CENA').start} - ${getShiftTimes('CENA').end}`}
                        isActive={isAvailable(dayOfWeek, 'CENA')}
                        isDisabled={dayDisabled}
                        holiday={cenaHoliday}
                        onToggle={() => toggleAvailability(day, dayOfWeek, 'CENA')}
                        canEdit={canEditDay(day) && !loading}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop View */}
            <div className="hidden sm:block overflow-hidden pd-card">
              <table className="min-w-full divide-y" style={{ borderColor: 'var(--pd-border)' }}>
                <thead style={{ background: 'var(--pd-surface-muted)' }}>
                  <tr>
                    <th className="text-left py-4 px-6 text-xs font-semibold" style={{ color: 'var(--pd-muted)' }}>Giorno</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold" style={{ color: 'var(--pd-muted)' }}>Pranzo</th>
                    <th className="text-center py-4 px-6 text-xs font-semibold" style={{ color: 'var(--pd-muted)' }}>Cena</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {weekDays.map((day, index) => {
                    const dOfW = getDayOfWeek(day)
                    const dDisabled = isDayDisabled(dOfW)
                    return (
                      <tr key={index} className={dDisabled ? 'bg-red-50/20' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <p className={`font-black tracking-tight ${dDisabled ? 'text-red-700' : 'text-gray-900'}`}>{getDayName(dOfW)}</p>
                          <p className="text-xs font-bold text-gray-400 uppercase">{formatDate(day)}</p>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <ShiftCell
                            isActive={isAvailable(dOfW, 'PRANZO')}
                            isDisabled={dDisabled}
                            holiday={holidayForSlot(day, 'PRANZO')}
                            onToggle={() => toggleAvailability(day, dOfW, 'PRANZO')}
                            canEdit={canEditDay(day) && !loading}
                          />
                        </td>
                        <td className="py-4 px-6 text-center">
                          <ShiftCell
                            isActive={isAvailable(dOfW, 'CENA')}
                            isDisabled={dDisabled}
                            holiday={holidayForSlot(day, 'CENA')}
                            onToggle={() => toggleAvailability(day, dOfW, 'CENA')}
                            canEdit={canEditDay(day) && !loading}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 pt-4 border-t flex flex-wrap items-center gap-x-4 gap-y-2" style={{ borderColor: 'var(--pd-border)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--pd-muted)' }}>Legenda</span>
              <div className="flex items-center gap-2" title="Turno non selezionabile">
                <Sparkles className="h-4 w-4 text-orange-400 shrink-0" aria-hidden />
                <span className="text-xs font-medium text-gray-600">Giorno festivo o locale chiuso</span>
              </div>
            </div>
          </div>

          {canEditAnyDay && (
            <div className="mt-8">
              <Button
                onClick={saveAvailability}
                disabled={saving || loading}
                isLoading={saving}
                className="w-full sm:w-auto sm:px-12 py-4 pd-btn-primary transition-all"
              >
                <Save className="h-5 w-5 mr-2" /> Salva disponibilità
              </Button>
            </div>
          )}
        </div>
      </div>
      <ToastContainer />
    </MainLayout>
  )
}

function ShiftToggle({ label, times, isActive, isDisabled, holiday, onToggle, canEdit }: any) {
  return (
    <div
      className="flex flex-col items-center p-3 transition-all border"
      style={{
        borderRadius: 'var(--pd-radius)',
        background: isActive ? 'var(--pd-success-soft)' : 'var(--pd-surface-muted)',
        borderColor: isActive ? 'color-mix(in srgb, var(--pd-success) 45%, transparent)' : 'var(--pd-border)',
      }}
    >
      <span className="text-xs font-semibold mb-1">{label}</span>
      <span className="text-[10px] font-medium mb-3" style={{ color: 'var(--pd-muted)' }}>{times}</span>
      {isDisabled ? (
        <Lock className="h-6 w-6 text-red-100" />
      ) : holiday ? (
        <div className="text-center">
          <Sparkles className="h-6 w-6 text-orange-400 mx-auto" />
          <span className="text-[10px] font-semibold block mt-1" style={{ color: 'var(--pd-warning)' }}>Festa</span>
        </div>
      ) : (
        <button
          onClick={onToggle}
          disabled={!canEdit}
          className={`w-12 h-12 flex items-center justify-center transition-all pd-press ${!canEdit ? 'opacity-50 grayscale' : ''}`}
          style={{
            borderRadius: 'var(--pd-radius)',
            background: isActive ? 'var(--pd-success)' : 'var(--pd-surface)',
            color: isActive ? 'var(--pd-accent-fg)' : 'var(--pd-muted)',
            border: isActive ? 'none' : '1px solid var(--pd-border)',
          }}
        >
          <CheckCircle className={`h-7 w-7 ${isActive ? 'scale-100' : 'scale-75 opacity-20'} transition-transform`} />
        </button>
      )}
    </div>
  )
}

function ShiftCell({ isActive, isDisabled, holiday, onToggle, canEdit }: any) {
  if (isDisabled) return <Lock className="h-5 w-5 text-red-200 mx-auto" />
  if (holiday) return <Sparkles className="h-5 w-5 text-orange-400 mx-auto" />
  return (
    <button
      onClick={onToggle}
      disabled={!canEdit}
      className={`w-8 h-8 rounded-xl border transition-all mx-auto flex items-center justify-center ${isActive ? 'bg-green-500 border-green-500 text-white shadow-sm' : 'bg-white border-gray-200 text-transparent'
        } ${!canEdit ? 'opacity-50' : 'hover:border-green-300'}`}
    >
      <CheckCircle className="h-5 w-5" />
    </button>
  )
}
