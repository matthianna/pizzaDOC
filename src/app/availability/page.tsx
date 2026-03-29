'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { useSession } from 'next-auth/react'
import { Calendar, ChevronLeft, ChevronRight, Save, AlertCircle, Lock, CheckCircle, Sparkles, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getWeekStart, getNextWeekStart, canEditAvailability, getWeekDays, formatDate, getDayOfWeek, getShiftTimes } from '@/lib/date-utils'
import { getDayName, getShiftTypeName } from '@/lib/utils'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useHaptics } from '@/hooks/use-haptics'
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

  const isUserPriority = session?.user.username ? isPriorityUser(session.user.username) : false
  const isAdmin = session?.user.roles.includes('ADMIN') && !isUserPriority

  // Check if the week has already started (can't edit availability)
  const hasWeekStarted = () => {
    const today = new Date()
    const monday = new Date(currentWeek)
    return today >= monday
  }

  const canEditThisWeek = !hasWeekStarted()

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
        alert('Disponibilità salvata con successo!')
      } else {
        alert('Errore durante il salvataggio')
      }
    } catch (error) {
      console.error('Error saving availability:', error)
      alert('Errore durante il salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const toggleAvailability = (calendarDay: Date, dayOfWeek: number, shiftType: 'PRANZO' | 'CENA') => {
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
    const newWeek = new Date(currentWeek)
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentWeek(newWeek)
  }

  const weekDays = getWeekDays(currentWeek)
  const canEdit = canEditThisWeek && canEditAvailability(currentWeek)

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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center tracking-tight">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg mr-4 drop-shadow-orange">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              Disponibilità
            </h1>
            <p className="text-gray-500 mt-2 font-medium">Indica i turni in cui puoi lavorare</p>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="bg-white rounded-3xl shadow-soft p-4 sm:p-6 border border-gray-50">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigateWeek('prev')} className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors active:scale-90">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="text-center">
              <h2 className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
              </h2>
              {!canEdit && (
                <div className="flex items-center justify-center mt-1 text-orange-600 font-bold">
                  <Lock className="h-3 w-3 mr-1" />
                  <span className="text-[10px] uppercase">Sola Lettura</span>
                </div>
              )}
            </div>
            <button onClick={() => navigateWeek('next')} className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors active:scale-90">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {absenceInfo.length > 0 && (
            <div className="mb-6 bg-red-50 border border-red-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-black text-red-900 uppercase tracking-tight">Assenze Programmate</h4>
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
                  <div key={index} className={`bg-white rounded-3xl shadow-soft border border-gray-100 p-5 transition-all ${dayDisabled ? 'bg-red-50/30' : ''}`}>
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-50">
                      <div>
                        <span className={`font-black text-lg tracking-tight ${dayDisabled ? 'text-red-800' : 'text-gray-900'}`}>
                          {getDayName(dayOfWeek)}
                        </span>
                        <p className="text-xs font-bold text-gray-400 uppercase">{formatDate(day)}</p>
                      </div>
                      {dayDisabled && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black">
                          <Ban className="h-3 w-3" /> ASSENTE
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
                        canEdit={canEdit && !loading}
                      />
                      <ShiftToggle
                        label="Cena"
                        times={`${getShiftTimes('CENA').start} - ${getShiftTimes('CENA').end}`}
                        isActive={isAvailable(dayOfWeek, 'CENA')}
                        isDisabled={dayDisabled}
                        holiday={cenaHoliday}
                        onToggle={() => toggleAvailability(day, dayOfWeek, 'CENA')}
                        canEdit={canEdit && !loading}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop View */}
            <div className="hidden sm:block overflow-hidden rounded-3xl border border-gray-100 shadow-soft">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="text-left py-4 px-6 font-black text-gray-400 text-[10px] uppercase tracking-widest">Giorno</th>
                    <th className="text-center py-4 px-6 font-black text-gray-400 text-[10px] uppercase tracking-widest">Pranzo</th>
                    <th className="text-center py-4 px-6 font-black text-gray-400 text-[10px] uppercase tracking-widest">Cena</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {weekDays.map((day, index) => {
                    const dOfW = getDayOfWeek(day)
                    const dDisabled = isDayDisabled(dOfW)
                    return (
                      <tr key={index} className={dDisabled ? 'bg-red-50/20' : ''}>
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
                            canEdit={canEdit && !loading}
                          />
                        </td>
                        <td className="py-4 px-6 text-center">
                          <ShiftCell
                            isActive={isAvailable(dOfW, 'CENA')}
                            isDisabled={dDisabled}
                            holiday={holidayForSlot(day, 'CENA')}
                            onToggle={() => toggleAvailability(day, dOfW, 'CENA')}
                            canEdit={canEdit && !loading}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {canEdit && (
            <div className="mt-8">
              <Button
                onClick={saveAvailability}
                disabled={saving || loading}
                isLoading={saving}
                className="w-full sm:w-auto sm:px-12 bg-orange-600 hover:bg-orange-700 text-white py-6 rounded-2xl font-black shadow-lg shadow-orange-500/20 transition-all active:scale-95"
              >
                <Save className="h-5 w-5 mr-2" /> SALVA DISPONIBILITÀ
              </Button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}

function ShiftToggle({ label, times, isActive, isDisabled, holiday, onToggle, canEdit }: any) {
  return (
    <div className={`flex flex-col items-center p-3 rounded-2xl border transition-all ${isActive ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-50'
      }`}>
      <span className="text-xs font-black text-gray-900 uppercase tracking-tight mb-1">{label}</span>
      <span className="text-[10px] font-bold text-gray-400 mb-3">{times}</span>
      {isDisabled ? (
        <Lock className="h-6 w-6 text-red-100" />
      ) : holiday ? (
        <div className="text-center">
          <Sparkles className="h-6 w-6 text-orange-400 mx-auto" />
          <span className="text-[10px] font-black text-orange-600 block mt-1 uppercase">Festa</span>
        </div>
      ) : (
        <button
          onClick={onToggle}
          disabled={!canEdit}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm active:scale-90 ${isActive ? 'bg-green-500 text-white shadow-glow-green' : 'bg-white border border-gray-200 text-gray-200'
            } ${!canEdit ? 'opacity-50 grayscale' : ''}`}
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
