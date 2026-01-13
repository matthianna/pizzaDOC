'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { useSession } from 'next-auth/react'
import { Calendar, ChevronLeft, ChevronRight, Save, AlertCircle, Lock, CheckCircle } from 'lucide-react'
import { getWeekStart, getNextWeekStart, canEditAvailability, getWeekDays, formatDate, getDayOfWeek, getShiftTimes } from '@/lib/date-utils'
import { getDayName, getShiftTypeName } from '@/lib/utils'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

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

  const isAdmin = session?.user.roles.includes('ADMIN')

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

  // ✅ Check if a specific shift is a holiday
  const isHoliday = (dayOfWeek: number, shiftType: 'PRANZO' | 'CENA'): Holiday | null => {
    const weekDays = getWeekDays(currentWeek)
    const dayDate = weekDays[dayOfWeek].toISOString().split('T')[0]

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
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          weekStart: currentWeek.toISOString(),
          availabilities
        })
      })

      if (response.ok) {
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

  const toggleAvailability = (dayOfWeek: number, shiftType: 'PRANZO' | 'CENA') => {
    if (disabledDays.includes(dayOfWeek)) return // Non permettere toggle per giorni in assenza
    if (isHoliday(dayOfWeek, shiftType)) return // ✅ Non permettere toggle per giorni festivi

    const existing = availabilities.find(a => a.dayOfWeek === dayOfWeek && a.shiftType === shiftType)

    if (existing) {
      setAvailabilities(availabilities.map(a =>
        a.dayOfWeek === dayOfWeek && a.shiftType === shiftType
          ? { ...a, isAvailable: !a.isAvailable }
          : a
      ))
    } else {
      setAvailabilities([...availabilities, {
        dayOfWeek,
        shiftType,
        isAvailable: true
      }])
    }
  }

  const isDayDisabled = (dayOfWeek: number) => {
    return disabledDays.includes(dayOfWeek)
  }

  // ✅ Check if a shift cell should be disabled (absence or holiday)
  const isShiftDisabled = (dayOfWeek: number, shiftType: 'PRANZO' | 'CENA') => {
    return isDayDisabled(dayOfWeek) || isHoliday(dayOfWeek, shiftType) !== null
  }

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

  // Blocca l'accesso agli admin
  if (isAdmin) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center max-w-md">
            <Lock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Accesso Limitato
            </h2>
            <p className="text-gray-600">
              La gestione delle disponibilità è riservata ai dipendenti.
              Gli amministratori non possono inserire la propria disponibilità.
            </p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
          <div>
            <h1 className="text-xl sm:text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3 text-orange-600" />
              Gestione Disponibilità
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Indica la tua disponibilità per i turni settimanali
            </p>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 mb-4">
            <button
              onClick={() => navigateWeek('prev')}
              className="flex items-center justify-center sm:justify-start px-3 py-2 text-gray-600 hover:text-gray-800 text-sm sm:text-base"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Settimana precedente</span>
              <span className="sm:hidden">Precedente</span>
            </button>

            <div className="text-center">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                Settimana dal {formatDate(weekDays[0])} al {formatDate(weekDays[6])}
              </h2>
              {!canEdit && (
                <div className="flex items-center justify-center mt-2 text-amber-600">
                  <Lock className="h-4 w-4 mr-1" />
                  <span className="text-xs sm:text-sm text-center">
                    {!canEditThisWeek
                      ? "Non è possibile modificare la disponibilità per settimane già iniziate"
                      : "Modifiche non consentite per questa settimana"
                    }
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => navigateWeek('next')}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-800"
            >
              Settimana successiva
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </div>

          {/* Absence Alert */}
          {absenceInfo.length > 0 && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-800 mb-1">
                    Assenze Programmate in Questa Settimana
                  </h4>
                  {absenceInfo.map((absence, i) => (
                    <p key={i} className="text-sm text-red-700 mb-1">
                      {format(new Date(absence.startDate), 'dd/MM/yyyy', { locale: it })} - {format(new Date(absence.endDate), 'dd/MM/yyyy', { locale: it })}
                      {absence.reason && ` (${absence.reason})`}
                    </p>
                  ))}
                  <p className="text-xs text-red-600 mt-2">
                    I giorni in cui sei assente sono disabilitati e non puoi inserire disponibilità.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Availability Grid */}
          <div className="space-y-4">
            {/* Mobile View: Cards */}
            <div className="block sm:hidden space-y-3">
              {weekDays.map((day, index) => {
                const dayOfWeek = getDayOfWeek(day)
                const dayDisabled = isDayDisabled(dayOfWeek)
                const pranzoHoliday = isHoliday(dayOfWeek, 'PRANZO')
                const cenaHoliday = isHoliday(dayOfWeek, 'CENA')

                return (
                  <div key={index} className={`bg-white rounded-xl shadow-sm border p-4 ${dayDisabled ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                      <div>
                        <span className={`font-bold text-lg ${dayDisabled ? 'text-red-800' : 'text-gray-900'}`}>
                          {getDayName(dayOfWeek)}
                        </span>
                        <p className="text-xs text-gray-500">{formatDate(day)}</p>
                      </div>
                      {dayDisabled && (
                        <span className="px-2 py-1 text-xs font-bold text-red-700 bg-red-100 rounded-lg">
                          ASSENTE
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Pranzo */}
                      <div className="flex flex-col items-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <span className="text-sm font-medium text-gray-700 mb-1">Pranzo</span>
                        <span className="text-[10px] text-gray-400 mb-2">{getShiftTimes('PRANZO').start} - {getShiftTimes('PRANZO').end}</span>

                        {dayDisabled ? (
                          <Lock className="h-6 w-6 text-red-300" />
                        ) : pranzoHoliday ? (
                          <div className="text-center">
                            <Calendar className="h-6 w-6 text-orange-400 mx-auto" />
                            <span className="text-[10px] text-orange-600 font-bold block mt-1">FESTIVO</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => toggleAvailability(dayOfWeek, 'PRANZO')}
                            disabled={!canEdit || loading}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${isAvailable(dayOfWeek, 'PRANZO')
                              ? 'bg-green-500 text-white shadow-green-200'
                              : 'bg-white border-2 border-gray-200 text-gray-300'
                              }`}
                          >
                            {isAvailable(dayOfWeek, 'PRANZO') && <CheckCircle className="h-6 w-6" />}
                          </button>
                        )}
                      </div>

                      {/* Cena */}
                      <div className="flex flex-col items-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <span className="text-sm font-medium text-gray-700 mb-1">Cena</span>
                        <span className="text-[10px] text-gray-400 mb-2">{getShiftTimes('CENA').start} - {getShiftTimes('CENA').end}</span>

                        {dayDisabled ? (
                          <Lock className="h-6 w-6 text-red-300" />
                        ) : cenaHoliday ? (
                          <div className="text-center">
                            <Calendar className="h-6 w-6 text-orange-400 mx-auto" />
                            <span className="text-[10px] text-orange-600 font-bold block mt-1">FESTIVO</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => toggleAvailability(dayOfWeek, 'CENA')}
                            disabled={!canEdit || loading}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${isAvailable(dayOfWeek, 'CENA')
                              ? 'bg-green-500 text-white shadow-green-200'
                              : 'bg-white border-2 border-gray-200 text-gray-300'
                              }`}
                          >
                            {isAvailable(dayOfWeek, 'CENA') && <CheckCircle className="h-6 w-6" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm uppercase tracking-wider">Giorno</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-900 text-sm uppercase tracking-wider">
                      Pranzo
                      <div className="text-xs font-normal text-gray-500 normal-case mt-0.5">
                        {getShiftTimes('PRANZO').start} - {getShiftTimes('PRANZO').end}
                      </div>
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-900 text-sm uppercase tracking-wider">
                      Cena
                      <div className="text-xs font-normal text-gray-500 normal-case mt-0.5">
                        {getShiftTimes('CENA').start} - {getShiftTimes('CENA').end}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {weekDays.map((day, index) => {
                    const dayOfWeek = getDayOfWeek(day)
                    const dayDisabled = isDayDisabled(dayOfWeek)
                    const pranzoHoliday = isHoliday(dayOfWeek, 'PRANZO')
                    const cenaHoliday = isHoliday(dayOfWeek, 'CENA')

                    return (
                      <tr key={index} className={`transition-colors ${dayDisabled ? 'bg-red-50/50' : 'hover:bg-gray-50'}`}>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div>
                            <div className={`font-medium ${dayDisabled ? 'text-red-700' : 'text-gray-900'}`}>
                              {getDayName(dayOfWeek)}
                              {dayDisabled && (
                                <span className="ml-2 px-2 py-0.5 text-[10px] font-bold text-red-700 bg-red-100 rounded-full border border-red-200">
                                  ASSENTE
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatDate(day)}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          {dayDisabled ? (
                            <div className="flex flex-col items-center justify-center">
                              <Lock className="h-5 w-5 text-red-300" />
                              <span className="text-[10px] text-red-400 mt-1 font-medium">BLOCCATO</span>
                            </div>
                          ) : pranzoHoliday ? (
                            <div className="flex flex-col items-center justify-center">
                              <Calendar className="h-5 w-5 text-orange-400" />
                              <span className="text-[10px] text-orange-600 mt-1 font-bold">FESTIVO</span>
                              {pranzoHoliday.description && (
                                <span className="text-[10px] text-gray-400 max-w-[100px] truncate">{pranzoHoliday.description}</span>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => toggleAvailability(dayOfWeek, 'PRANZO')}
                              disabled={!canEdit || loading}
                              className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center mx-auto ${isAvailable(dayOfWeek, 'PRANZO')
                                ? 'bg-green-500 border-green-500 text-white shadow-sm scale-110'
                                : 'bg-white border-gray-200 hover:border-gray-300 text-transparent'
                                } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <CheckCircle className="h-6 w-6" />
                            </button>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          {dayDisabled ? (
                            <div className="flex flex-col items-center justify-center">
                              <Lock className="h-5 w-5 text-red-300" />
                              <span className="text-[10px] text-red-400 mt-1 font-medium">BLOCCATO</span>
                            </div>
                          ) : cenaHoliday ? (
                            <div className="flex flex-col items-center justify-center">
                              <Calendar className="h-5 w-5 text-orange-400" />
                              <span className="text-[10px] text-orange-600 mt-1 font-bold">FESTIVO</span>
                              {cenaHoliday.description && (
                                <span className="text-[10px] text-gray-400 max-w-[100px] truncate">{cenaHoliday.description}</span>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => toggleAvailability(dayOfWeek, 'CENA')}
                              disabled={!canEdit || loading}
                              className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center mx-auto ${isAvailable(dayOfWeek, 'CENA')
                                ? 'bg-green-500 border-green-500 text-white shadow-sm scale-110'
                                : 'bg-white border-gray-200 hover:border-gray-300 text-transparent'
                                } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <CheckCircle className="h-6 w-6" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {canEdit && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={saveAvailability}
                disabled={saving}
                className="bg-orange-600 text-white px-6 py-2 rounded-md hover:bg-orange-700 flex items-center disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salva Disponibilità'}
              </button>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Legenda</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
              <span>Disponibile</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full border-2 border-gray-300 mr-2"></div>
              <span>Non disponibile</span>
            </div>
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-amber-600 mr-2" />
              <span>Modifiche non consentite</span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
