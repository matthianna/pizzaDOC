'use client'

import React, { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, ChevronLeft, ChevronRight, Users, Check, X } from 'lucide-react'
import { format, addWeeks, subWeeks, addDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { getDayName, getRoleName } from '@/lib/utils'
import { getWeekStart } from '@/lib/date-utils'

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

export default function AvailabilityOverviewPage() {
  const [currentWeek, setCurrentWeek] = useState(() => {
    return getWeekStart(new Date())
  })
  const [usersAvailability, setUsersAvailability] = useState<UserAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRole, setSelectedRole] = useState<string>('ALL')

  useEffect(() => {
    fetchAvailability()
  }, [currentWeek])

  const fetchAvailability = async () => {
    setLoading(true)
    try {
      // ⚠️ Aggiungi timestamp per forzare bypass cache browser
      const timestamp = new Date().getTime()
      const response = await fetch(
        `/api/admin/availability-overview?weekStart=${currentWeek.toISOString()}&_t=${timestamp}`,
        {
          cache: 'no-store', // ⚠️ Disabilita cache browser
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
      )
      if (response.ok) {
        const data = await response.json()
        setUsersAvailability(data.users)
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
    } finally {
      setLoading(false)
    }
  }

  const goToPreviousWeek = () => {
    // ⭐ USA getWeekStart per garantire normalizzazione UTC corretta
    setCurrentWeek(prev => getWeekStart(subWeeks(prev, 1)))
  }

  const goToNextWeek = () => {
    // ⭐ USA getWeekStart per garantire normalizzazione UTC corretta
    setCurrentWeek(prev => getWeekStart(addWeeks(prev, 1)))
  }

  const goToCurrentWeek = () => {
    setCurrentWeek(getWeekStart(new Date()))
  }

  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
  const shifts = ['PRANZO', 'CENA']

  const filteredUsers = selectedRole === 'ALL' 
    ? usersAvailability 
    : usersAvailability.filter(u => u.primaryRole === selectedRole)

  // Calcola statistiche
  const totalAvailabilities = filteredUsers.reduce((sum, user) => {
    return sum + user.availabilities.filter(a => a.isAvailable).length
  }, 0)

  const totalSlots = filteredUsers.length * 7 * 2 // users * days * shifts
  const availabilityPercentage = totalSlots > 0 ? (totalAvailabilities / totalSlots) * 100 : 0

  return (
    <MainLayout adminOnly>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
            <Users className="h-6 w-6 sm:h-8 sm:w-8 mr-3 text-orange-600" />
            Disponibilità Utenti
          </h1>
          <p className="text-gray-600 mt-1">
            Visualizza le disponibilità di tutti gli utenti per la settimana
          </p>
        </div>

        {/* Week Navigation & Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Week Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={goToPreviousWeek}
                className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="text-center px-4">
                <div className="text-lg font-semibold text-gray-900">
                  {format(currentWeek, 'dd MMM', { locale: it })} - {format(addDays(currentWeek, 6), 'dd MMM yyyy', { locale: it })}
                </div>
              </div>

              <button
                onClick={goToNextWeek}
                className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              <button
                onClick={goToCurrentWeek}
                className="ml-2 px-3 py-2 text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors font-medium"
              >
                Questa settimana
              </button>
            </div>

            {/* Role Filter */}
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700">Filtra per ruolo:</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="ALL">Tutti</option>
                <option value="FATTORINO">Fattorino</option>
                <option value="CUCINA">Cucina</option>
                <option value="SALA">Sala</option>
                <option value="PIZZAIOLO">Pizzaiolo</option>
              </select>
            </div>
          </div>

          {/* Statistics */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm text-blue-700 font-medium">Utenti</div>
              <div className="text-xl sm:text-2xl font-bold text-blue-900">{filteredUsers.length}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-sm text-green-700 font-medium">Disponibilità Totali</div>
              <div className="text-xl sm:text-2xl font-bold text-green-900">{totalAvailabilities}</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="text-sm text-orange-700 font-medium">Copertura</div>
              <div className="text-xl sm:text-2xl font-bold text-orange-900">{availabilityPercentage.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Availability Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-orange-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="sticky left-0 z-10 bg-gray-100 px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Utente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Ruolo
                    </th>
                    {days.map((day, idx) => (
                      <th key={idx} colSpan={2} className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider border-l border-gray-300">
                        {day.substring(0, 3)}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-10 bg-gray-50"></th>
                    <th className="bg-gray-50"></th>
                    {days.map((_, dayIdx) => (
                      <React.Fragment key={dayIdx}>
                        <th className="px-1 py-2 text-center text-xs text-gray-600 border-l border-gray-300">
                          P
                        </th>
                        <th className="px-1 py-2 text-center text-xs text-gray-600">
                          C
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => {
                    // Funzione helper per controllare se un giorno specifico è in assenza
                    const isAbsentOnDay = (dayIdx: number): boolean => {
                      const dayDate = addDays(currentWeek, dayIdx)
                      // Normalizza tutte le date a mezzanotte per confronto corretto
                      const dayDateNormalized = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate())
                      
                      return user.absences.some(abs => {
                        const absStartDate = new Date(abs.startDate)
                        const absEndDate = new Date(abs.endDate)
                        const absStart = new Date(absStartDate.getFullYear(), absStartDate.getMonth(), absStartDate.getDate())
                        const absEnd = new Date(absEndDate.getFullYear(), absEndDate.getMonth(), absEndDate.getDate())
                        
                        return dayDateNormalized >= absStart && dayDateNormalized <= absEnd
                      })
                    }

                    return (
                      <tr key={user.userId} className="hover:bg-gray-50">
                        <td className="sticky left-0 z-10 bg-white hover:bg-gray-50 px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">{user.username}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                            {getRoleName(user.primaryRole as any)}
                          </span>
                        </td>
                        {days.map((_, dayIdx) => {
                          const pranzoAvail = user.availabilities.find(a => a.dayOfWeek === dayIdx && a.shiftType === 'PRANZO')
                          const cenaAvail = user.availabilities.find(a => a.dayOfWeek === dayIdx && a.shiftType === 'CENA')
                          const isAbsent = isAbsentOnDay(dayIdx)

                          return (
                            <React.Fragment key={`${user.id}-${dayIdx}`}>
                              <td className="px-2 py-3 text-center border-l border-gray-200">
                                {isAbsent ? (
                                  <span className="text-red-600 font-bold text-sm">A</span>
                                ) : pranzoAvail?.isAvailable ? (
                                  <span className="text-lg">🟢</span>
                                ) : (
                                  <X className="h-5 w-5 text-gray-300 mx-auto" />
                                )}
                              </td>
                              <td className="px-2 py-3 text-center">
                                {isAbsent ? (
                                  <span className="text-red-600 font-bold text-sm">A</span>
                                ) : cenaAvail?.isAvailable ? (
                                  <span className="text-lg">🟢</span>
                                ) : (
                                  <X className="h-5 w-5 text-gray-300 mx-auto" />
                                )}
                              </td>
                            </React.Fragment>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nessun utente trovato</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Legenda</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
            <div className="flex items-center">
              <span className="text-lg mr-2">🟢</span>
              <span className="text-gray-700">Disponibile</span>
            </div>
            <div className="flex items-center">
              <X className="h-4 w-4 text-gray-300 mr-2" />
              <span className="text-gray-700">Non disponibile</span>
            </div>
            <div className="flex items-center">
              <span className="text-red-600 font-bold text-sm mr-2">A</span>
              <span className="text-gray-700">Assente</span>
            </div>
            <div className="flex items-center">
              <span className="text-xs text-gray-600">P = Pranzo | C = Cena</span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

