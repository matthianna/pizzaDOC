'use client'

import React, { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Calendar, ChevronLeft, ChevronRight, Users, Check, X } from 'lucide-react'
import { format, addWeeks, subWeeks, addDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { cn, getDayName, getRoleName } from '@/lib/utils'
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
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Moderno */}
        <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-orange-600 rounded-2xl shadow-lg shadow-orange-200">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                  Disponibilità Utenti
                </h1>
                <p className="text-gray-500 font-medium mt-1">
                  Panoramica settimanale di tutta la squadra PizzaDOC.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-1 rounded-2xl flex items-center">
                <button
                  onClick={goToPreviousWeek}
                  className="p-3 text-gray-500 hover:text-orange-600 transition-all active:scale-90"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="px-4 py-2 bg-white rounded-xl shadow-sm text-sm font-black text-gray-900 min-w-[180px] text-center">
                  {format(currentWeek, 'd MMM', { locale: it })} — {format(addDays(currentWeek, 6), 'd MMM yyyy', { locale: it })}
                </div>
                <button
                  onClick={goToNextWeek}
                  className="p-3 text-gray-500 hover:text-orange-600 transition-all active:scale-90"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <button
                onClick={goToCurrentWeek}
                className="px-5 py-3 bg-orange-50 text-orange-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-orange-100 transition-all"
              >
                Oggi
              </button>
            </div>
          </div>
        </div>

        {/* Filters & Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 bg-white rounded-3xl shadow-soft border border-gray-100 p-6 flex flex-col justify-center">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Filtra Personale</label>
            <div className="relative">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full pl-4 pr-10 py-3 bg-gray-50 border-gray-200 rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all appearance-none"
              >
                <option value="ALL">Tutti i Ruoli</option>
                <option value="FATTORINO">Fattorini</option>
                <option value="CUCINA">Cucina</option>
                <option value="SALA">Sala</option>
                <option value="PIZZAIOLO">Pizzaioli</option>
              </select>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rotate-90" />
            </div>
          </div>

          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Personale', value: filteredUsers.length, color: 'blue', icon: Users },
              { label: 'Slot Coperti', value: totalAvailabilities, color: 'green', icon: Check },
              { label: 'Tasso Copertura', value: `${availabilityPercentage.toFixed(1)}%`, color: 'orange', icon: Calendar }
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-3xl shadow-soft border border-gray-100 p-6 flex items-center gap-4">
                <div className={cn("p-3 rounded-2xl shadow-sm", `bg-${stat.color}-50 text-${stat.color}-600`)}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                  <p className="text-xl font-black text-gray-900">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Table Moderno */}
        <div className="bg-white rounded-[2rem] shadow-soft border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-20 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Sincronizzazione dati...</p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-hide">
              <table className="min-w-full divide-y divide-gray-100">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="sticky left-0 z-20 bg-gray-50/80 backdrop-blur-md px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-r border-gray-100/50 min-w-[180px]">
                      Membro Squadra
                    </th>
                    {days.map((day, idx) => (
                      <th key={idx} colSpan={2} className={cn(
                        "px-2 py-5 text-center text-[10px] font-black uppercase tracking-widest border-l border-gray-100/50",
                        idx % 2 === 0 ? "bg-gray-50/30" : "bg-white"
                      )}>
                        {day}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-gray-50/30 border-b border-gray-100">
                    <th className="sticky left-0 z-20 bg-gray-50/80 backdrop-blur-md border-r border-gray-100/50"></th>
                    {days.map((_, dayIdx) => (
                      <React.Fragment key={dayIdx}>
                        <th className="px-1 py-2 text-center text-[9px] font-black text-gray-400 uppercase tracking-tighter border-l border-gray-100/50 bg-orange-50/20">
                          Pranzo
                        </th>
                        <th className="px-1 py-2 text-center text-[9px] font-black text-gray-400 uppercase tracking-tighter bg-blue-50/20">
                          Cena
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((user) => {
                    const isAbsentOnDay = (dayIdx: number): boolean => {
                      const dayDate = addDays(currentWeek, dayIdx)
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
                      <tr key={user.userId} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50/80 px-6 py-4 whitespace-nowrap border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-black text-orange-600 border border-orange-200">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-black text-gray-900 leading-none mb-1">{user.username}</p>
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{getRoleName(user.primaryRole as any)}</p>
                            </div>
                          </div>
                        </td>
                        {days.map((_, dayIdx) => {
                          const pranzoAvail = user.availabilities.find(a => a.dayOfWeek === dayIdx && a.shiftType === 'PRANZO')
                          const cenaAvail = user.availabilities.find(a => a.dayOfWeek === dayIdx && a.shiftType === 'CENA')
                          const isAbsent = isAbsentOnDay(dayIdx)

                          return (
                            <React.Fragment key={`${user.userId}-${dayIdx}`}>
                              <td className="px-2 py-4 text-center border-l border-gray-50 relative group/cell">
                                {isAbsent ? (
                                  <div className="flex items-center justify-center p-1 bg-red-50 rounded-lg" title="Assente">
                                    <span className="text-[10px] font-black text-red-600">ABS</span>
                                  </div>
                                ) : pranzoAvail?.isAvailable ? (
                                  <div className="flex items-center justify-center">
                                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm shadow-green-200 animate-in zoom-in duration-300">
                                      <Check className="h-3.5 w-3.5 text-white stroke-[4]" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center opacity-20">
                                    <X className="h-4 w-4 text-gray-400" />
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-4 text-center relative group/cell">
                                {isAbsent ? (
                                  <div className="flex items-center justify-center p-1 bg-red-50 rounded-lg" title="Assente">
                                    <span className="text-[10px] font-black text-red-600">ABS</span>
                                  </div>
                                ) : cenaAvail?.isAvailable ? (
                                  <div className="flex items-center justify-center">
                                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm shadow-green-200 animate-in zoom-in duration-300">
                                      <Check className="h-3.5 w-3.5 text-white stroke-[4]" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center opacity-20">
                                    <X className="h-4 w-4 text-gray-400" />
                                  </div>
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
                <div className="text-center py-20 bg-gray-50/50">
                  <div className="p-4 bg-white rounded-full w-fit mx-auto mb-4 shadow-sm border border-gray-100">
                    <Users className="h-10 w-10 text-gray-200" />
                  </div>
                  <p className="text-gray-400 font-black uppercase tracking-widest text-sm">Nessun membro trovato</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Legend Moderna */}
        <div className="bg-white rounded-3xl shadow-soft border border-gray-100 p-6">
          <div className="flex flex-wrap items-center gap-8 justify-center sm:justify-start">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                <Check className="h-3.5 w-3.5 text-white stroke-[4]" />
              </div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Disponibile</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200">
                <X className="h-3.5 w-3.5 text-gray-300" />
              </div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Chiuso / No</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-2 py-1 bg-red-50 text-red-600 rounded-lg border border-red-100">
                <span className="text-[9px] font-black uppercase">ABS</span>
              </div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">In Vacanza / Assente</span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

