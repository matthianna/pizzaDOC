'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { useSession } from 'next-auth/react'
import { Calendar, ChevronLeft, ChevronRight, Save, AlertCircle, Lock, XCircle } from 'lucide-react'
import { getWeekStart, getNextWeekStart, getWeekDays, formatDate } from '@/lib/date-utils'
import { getDayName, getShiftTypeName } from '@/lib/utils'
import { addDays, format, startOfDay, endOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { useToast } from '@/components/ui/toast'

interface Availability {
  dayOfWeek: number
  shiftType: 'PRANZO' | 'CENA'
  isAvailable: boolean
}

interface DayAbsence {
  dayOfWeek: number
  isAbsent: boolean
  absenceInfo?: {
    id: string
    type: string
    reason: string | null
  }
}

export default function AvailabilityPage() {
  const { data: session } = useSession()
  const [currentWeek, setCurrentWeek] = useState(getNextWeekStart())
  const [availabilities, setAvailabilities] = useState<Availability[]>([])
  const [dayAbsences, setDayAbsences] = useState<DayAbsence[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { showToast, ToastContainer } = useToast()

  const isAdmin = session?.user.roles?.includes('ADMIN')
  
  const hasWeekStarted = () => {
    const today = startOfDay(new Date())
    const monday = startOfDay(currentWeek)
    return today >= monday
  }
  
  const canEditThisWeek = !hasWeekStarted()

  useEffect(() => {
    fetchAvailability()
    checkAbsences()
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

  const checkAbsences = async () => {
    try {
      const weekDates = getWeekDays(currentWeek)
      const absenceChecks = await Promise.all(
        weekDates.map(async (date, index) => {
          const response = await fetch(`/api/absences/check?date=${date.toISOString()}`)
          if (response.ok) {
            const data = await response.json()
            return {
              dayOfWeek: index,
              isAbsent: data.isAbsent,
              absenceInfo: data.absences?.[0]
            }
          }
          return { dayOfWeek: index, isAbsent: false }
        })
      )
      setDayAbsences(absenceChecks)
    } catch (error) {
      console.error('Error checking absences:', error)
    }
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
        showToast('Disponibilità salvata con successo', 'success')
      } else {
        showToast('Errore nel salvataggio', 'error')
      }
    } catch (error) {
      showToast('Errore nel salvataggio', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleAvailability = (dayOfWeek: number, shiftType: 'PRANZO' | 'CENA') => {
    // Controlla se il giorno è in assenza
    const dayAbsence = dayAbsences.find(d => d.dayOfWeek === dayOfWeek)
    if (dayAbsence?.isAbsent) {
      showToast('Non puoi inserire disponibilità durante un\'assenza', 'error')
      return
    }

    const existing = availabilities.find(
      a => a.dayOfWeek === dayOfWeek && a.shiftType === shiftType
    )

    if (existing) {
      setAvailabilities(availabilities.map(a =>
        a.dayOfWeek === dayOfWeek && a.shiftType === shiftType
          ? { ...a, isAvailable: !a.isAvailable }
          : a
      ))
    } else {
      setAvailabilities([
        ...availabilities,
        { dayOfWeek, shiftType, isAvailable: true }
      ])
    }
  }

  const isAvailable = (dayOfWeek: number, shiftType: 'PRANZO' | 'CENA') => {
    const availability = availabilities.find(
      a => a.dayOfWeek === dayOfWeek && a.shiftType === shiftType
    )
    return availability?.isAvailable || false
  }

  const isDayAbsent = (dayOfWeek: number) => {
    return dayAbsences.find(d => d.dayOfWeek === dayOfWeek)?.isAbsent || false
  }

  const getAbsenceInfo = (dayOfWeek: number) => {
    return dayAbsences.find(d => d.dayOfWeek === dayOfWeek)?.absenceInfo
  }

  const goToPreviousWeek = () => {
    const prevWeek = new Date(currentWeek)
    prevWeek.setDate(prevWeek.getDate() - 7)
    setCurrentWeek(prevWeek)
  }

  const goToNextWeek = () => {
    const nextWeek = new Date(currentWeek)
    nextWeek.setDate(nextWeek.getDate() + 7)
    setCurrentWeek(nextWeek)
  }

  const weekDates = getWeekDays(currentWeek)
  const weekDays = weekDates.map((date, index) => ({
    dayOfWeek: index,
    date,
    name: format(date, 'EEEE', { locale: it })
  }))

  return (
    <MainLayout>
      <ToastContainer />
      
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Disponibilità Settimanale</h1>
            <p className="text-sm text-gray-600 mt-1">Indica quando sei disponibile a lavorare</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={goToPreviousWeek}
              className="p-2 hover:bg-gray-100 rounded-lg"
              aria-label="Settimana precedente"
            >
              <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8 text-gray-700" />
              <span className="hidden sm:inline text-sm ml-1">Precedente</span>
            </button>
            
            <div className="text-center px-3">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 mx-auto text-orange-600" />
              <div className="text-xs sm:text-sm font-medium text-gray-900 mt-1">
                {formatDate(currentWeek)}
              </div>
            </div>
            
            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg"
              aria-label="Settimana successiva"
            >
              <span className="hidden sm:inline text-sm mr-1">Successiva</span>
              <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8 text-gray-700" />
            </button>
          </div>
        </div>

        {!canEditThisWeek && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
            <Lock className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Settimana non modificabile</p>
              <p className="mt-1">Puoi modificare solo le settimane future.</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gradient-to-r from-orange-500 to-orange-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Giorno
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">
                      Pranzo
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider">
                      Cena
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {weekDays.map(({ dayOfWeek, date, name }) => {
                    const isAbsent = isDayAbsent(dayOfWeek)
                    const absenceInfo = getAbsenceInfo(dayOfWeek)
                    
                    return (
                      <tr key={dayOfWeek} className={isAbsent ? 'bg-red-50' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {isAbsent && <XCircle className="h-5 w-5 text-red-600 mr-2" />}
                            <div>
                              <div className="text-sm font-medium text-gray-900">{name}</div>
                              <div className="text-xs text-gray-500">{format(date, 'dd/MM')}</div>
                              {isAbsent && absenceInfo && (
                                <div className="text-xs text-red-600 mt-1">
                                  Assenza: {absenceInfo.type === 'VACATION' ? 'Ferie' : 
                                           absenceInfo.type === 'SICK_LEAVE' ? 'Malattia' : 
                                           absenceInfo.type === 'PERSONAL' ? 'Permesso' : 'Altro'}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {isAbsent ? (
                            <div className="flex items-center justify-center">
                              <Lock className="h-5 w-5 text-red-400" />
                            </div>
                          ) : (
                            <button
                              onClick={() => toggleAvailability(dayOfWeek, 'PRANZO')}
                              disabled={!canEditThisWeek}
                              className={`w-20 h-10 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                isAvailable(dayOfWeek, 'PRANZO')
                                  ? 'bg-green-500 text-white hover:bg-green-600'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {isAvailable(dayOfWeek, 'PRANZO') ? '✓' : '—'}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {isAbsent ? (
                            <div className="flex items-center justify-center">
                              <Lock className="h-5 w-5 text-red-400" />
                            </div>
                          ) : (
                            <button
                              onClick={() => toggleAvailability(dayOfWeek, 'CENA')}
                              disabled={!canEditThisWeek}
                              className={`w-20 h-10 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                isAvailable(dayOfWeek, 'CENA')
                                  ? 'bg-green-500 text-white hover:bg-green-600'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {isAvailable(dayOfWeek, 'CENA') ? '✓' : '—'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {canEditThisWeek && (
          <div className="flex justify-end">
            <button
              onClick={saveAvailability}
              disabled={saving}
              className="flex items-center px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <Save className="h-5 w-5 mr-2" />
              {saving ? 'Salvataggio...' : 'Salva Disponibilità'}
            </button>
          </div>
        )}

        {/* Legenda */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">Come funziona:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Clicca sui pulsanti per indicare la tua disponibilità</li>
                <li><span className="font-medium text-green-600">Verde (✓)</span> = Disponibile</li>
                <li><span className="font-medium text-gray-600">Grigio (—)</span> = Non disponibile</li>
                <li><XCircle className="h-4 w-4 text-red-600 inline mr-1" />Giorni bloccati per assenza programmata</li>
                <li>Ricorda di salvare le modifiche prima di cambiare settimana!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}