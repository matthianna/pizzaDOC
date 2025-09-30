'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { useSession } from 'next-auth/react'
import { Calendar, ChevronLeft, ChevronRight, Save, AlertCircle, Lock, MapPin, ExternalLink } from 'lucide-react'
import { getWeekStart, getNextWeekStart, canEditAvailability, getWeekDays, formatDate, getDayOfWeek, getShiftTimes } from '@/lib/date-utils'
import { getDayName, getShiftTypeName } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

interface Availability {
  dayOfWeek: number
  shiftType: 'PRANZO' | 'CENA'
  isAvailable: boolean
}

export default function AvailabilityPage() {
  const { data: session } = useSession()
  const [currentWeek, setCurrentWeek] = useState(getNextWeekStart())
  const [availabilities, setAvailabilities] = useState<Availability[]>([])
  const [isAbsentWeek, setIsAbsentWeek] = useState(false)
  const [absenceDetails, setAbsenceDetails] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

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
    checkAbsences()
  }, [currentWeek])

  const checkAbsences = async () => {
    try {
      const response = await fetch(`/api/user/absences/check?weekStart=${currentWeek.toISOString()}`)
      if (response.ok) {
        const data = await response.json()
        setIsAbsentWeek(data.hasAbsence)
        setAbsenceDetails(data.absences || [])
      }
    } catch (error) {
      console.error('Error checking absences:', error)
    }
  }

  const fetchAvailability = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/availability?weekStart=${currentWeek.toISOString()}`)
      if (response.ok) {
        const data = await response.json()
        
        // Don't use old isAbsentWeek logic, use new absence system
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
          availabilities,
          isAbsentWeek
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
    if (isAbsentWeek) return

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

  const isAvailable = (dayOfWeek: number, shiftType: 'PRANZO' | 'CENA') => {
    return availabilities.find(a => a.dayOfWeek === dayOfWeek && a.shiftType === shiftType)?.isAvailable || false
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek)
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentWeek(newWeek)
  }

  const getAbsenceTypeName = (type: string) => {
    switch (type) {
      case 'VACATION': return 'Vacanze'
      case 'SICK_LEAVE': return 'Malattia'
      case 'PERSONAL': return 'Permesso Personale'
      case 'OTHER': return 'Altro'
      default: return type
    }
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
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3 text-orange-600" />
              Gestione Disponibilità
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Indica la tua disponibilità per i turni settimanali
            </p>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
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

          {/* Absence Warning */}
          {isAbsentWeek && absenceDetails.length > 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start">
                <MapPin className="h-5 w-5 text-amber-600 mt-0.5 mr-3" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-amber-800">
                    Sei in assenza durante questa settimana
                  </h3>
                  <div className="mt-2 space-y-2">
                    {absenceDetails.map((absence, index) => (
                      <div key={index} className="text-sm text-amber-700">
                        <strong>{getAbsenceTypeName(absence.type)}</strong> dal{' '}
                        {format(parseISO(absence.startDate), 'dd/MM', { locale: it })} al{' '}
                        {format(parseISO(absence.endDate), 'dd/MM/yyyy', { locale: it })}
                        {absence.reason && (
                          <span className="block text-xs mt-1">Motivo: {absence.reason}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <a
                      href="/absences"
                      className="inline-flex items-center text-sm text-amber-800 hover:text-amber-900 font-medium"
                    >
                      Gestisci le tue assenze
                      <ExternalLink className="h-4 w-4 ml-1" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {canEdit && !isAbsentWeek && (
            <div className="mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isAbsentWeek}
                  onChange={(e) => {
                    setIsAbsentWeek(e.target.checked)
                    if (e.target.checked) {
                      setAvailabilities([])
                    }
                  }}
                  className="mr-2 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Assente tutta la settimana
                </span>
              </label>
            </div>
          )}

          {/* Availability Grid */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Giorno</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">
                    Pranzo
                    <div className="text-xs font-normal text-gray-500">
                      {getShiftTimes('PRANZO').start} - {getShiftTimes('PRANZO').end}
                    </div>
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">
                    Cena
                    <div className="text-xs font-normal text-gray-500">
                      {getShiftTimes('CENA').start} - {getShiftTimes('CENA').end}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {weekDays.map((day, index) => {
                  const dayOfWeek = getDayOfWeek(day)
                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div>
                          <div className="font-medium text-gray-900">
                            {getDayName(dayOfWeek)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(day)}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => toggleAvailability(dayOfWeek, 'PRANZO')}
                          disabled={!canEdit || isAbsentWeek || loading}
                          className={`w-8 h-8 rounded-full border-2 transition-colors ${
                            isAvailable(dayOfWeek, 'PRANZO')
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'bg-white border-gray-300 hover:border-gray-400'
                          } ${!canEdit || isAbsentWeek ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {isAvailable(dayOfWeek, 'PRANZO') && '✓'}
                        </button>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => toggleAvailability(dayOfWeek, 'CENA')}
                          disabled={!canEdit || isAbsentWeek || loading}
                          className={`w-8 h-8 rounded-full border-2 transition-colors ${
                            isAvailable(dayOfWeek, 'CENA')
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'bg-white border-gray-300 hover:border-gray-400'
                          } ${!canEdit || isAbsentWeek ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {isAvailable(dayOfWeek, 'CENA') && '✓'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-black mb-4">Legenda</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-black">
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
