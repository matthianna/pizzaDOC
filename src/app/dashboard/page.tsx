'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { useSession } from 'next-auth/react'
import { Users, Calendar, Clock, BarChart3, UserCheck, TrendingUp, CalendarDays, AlertCircle, Settings, Shield, CheckIcon, Bike, Car, UtensilsCrossed, ChefHat, Pizza } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { getRoleName, getDayName } from '@/lib/utils'
import type { Role } from '@prisma/client'

interface DashboardStats {
  // Admin stats
  totalUsers?: number
  activeUsers?: number
  pendingHours?: number
  thisWeekSchedules?: number
  pendingSubstitutions?: number
  totalShiftsThisWeek?: number
  totalAbsencesActive?: number
  availabilitiesThisWeek?: number
  approvedSubstitutions?: number
  
  // User stats
  myShiftsThisWeek?: number
  myHoursThisMonth?: number
  myPendingSubstitutions?: number
  myApprovedHours?: number
}

interface TodayShift {
  id: string
  shiftType: 'PRANZO' | 'CENA'
  role: string
  startTime: string
  endTime: string
  user: {
    id: string
    username: string
    primaryRole: string
    primaryTransport?: string
    user_transports?: { transport: string }[]
  }
}

interface TodayShiftsData {
  date: string
  dayOfWeek: number
  shifts: Record<string, TodayShift[]>
  totalWorkers: number
}

interface MyShift {
  id: string
  dayOfWeek: number
  dayName: string
  date: string
  shiftType: 'PRANZO' | 'CENA'
  role: string
  startTime: string
  endTime: string
  isToday: boolean
  isPast: boolean
}

interface MyShiftsData {
  shifts: MyShift[]
  total: number
}

interface MissingHoursData {
  missingShifts: Array<{
    id: string
    date: string
    dayOfWeek: number
    shiftType: 'PRANZO' | 'CENA'
    role: string
    startTime: string
    endTime: string
  }>
  count: number
}

interface PendingHoursData {
  users: Array<{
    user: {
      id: string
      username: string
      primaryRole: string
    }
    pendingShifts: Array<{
      id: string
      shiftId: string
      startTime: string
      endTime: string
      totalHours: number
      submittedAt: string
      shift: {
        dayOfWeek: number
        shiftType: string
        role: string
        startTime: string
        endTime: string
        schedule: {
          weekStart: string
        }
      }
    }>
    totalHours: number
    shiftsCount: number
  }>
  totalUsers: number
  totalShifts: number
  totalHours: number
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats>({})
  const [todayShifts, setTodayShifts] = useState<TodayShiftsData | null>(null)
  const [myShifts, setMyShifts] = useState<MyShiftsData | null>(null)
  const [pendingHours, setPendingHours] = useState<PendingHoursData | null>(null)
  const [missingHours, setMissingHours] = useState<MissingHoursData | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = session?.user.roles.includes('ADMIN')

  useEffect(() => {
    // Aspetta che la sessione sia caricata prima di fare le chiamate API
    if (!session) return
    
    fetchStats()
    fetchTodayShifts()
    if (!isAdmin) {
      fetchMyShifts()
      fetchMissingHours()
    } else {
      fetchPendingHours()
    }
  }, [session, isAdmin])

  const fetchTodayShifts = async () => {
    try {
      const response = await fetch('/api/dashboard/today-shifts')
      if (response.ok) {
        const data = await response.json()
        setTodayShifts(data)
      } else {
        // Set empty data if request fails
        setTodayShifts({
          date: new Date().toISOString(),
          dayOfWeek: 0,
          shifts: {},
          totalWorkers: 0
        })
      }
    } catch (error) {
      console.error('Error fetching today shifts:', error)
      // Set empty data if request fails
      setTodayShifts({
        date: new Date().toISOString(),
        dayOfWeek: 0,
        shifts: {},
        totalWorkers: 0
      })
    }
  }

  const fetchMyShifts = async () => {
    try {
      const response = await fetch('/api/dashboard/my-shifts')
      if (response.ok) {
        const data = await response.json()
        setMyShifts(data)
      }
    } catch (error) {
      console.error('Error fetching my shifts:', error)
    }
  }

  const fetchPendingHours = async () => {
    try {
      // ⚠️ Aggiungi timestamp per forzare bypass cache browser
      const timestamp = new Date().getTime()
      const response = await fetch(
        `/api/dashboard/pending-hours?_t=${timestamp}`,
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
        setPendingHours(data)
      }
    } catch (error) {
      console.error('Error fetching pending hours:', error)
    }
  }

  const fetchMissingHours = async () => {
    try {
      // ⚠️ Aggiungi timestamp per forzare bypass cache browser
      const timestamp = new Date().getTime()
      const response = await fetch(
        `/api/dashboard/missing-hours?_t=${timestamp}`,
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
        setMissingHours(data)
      }
    } catch (error) {
      console.error('Error fetching missing hours:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Benvenuto, {session?.user.username}!
          </h1>
          <p className="text-gray-800 mt-2 text-sm sm:text-base">
            Dashboard - Sistema di gestione piano di lavoro pizzeria
          </p>
          <div className="mt-3 sm:mt-4 flex items-center text-sm text-gray-700">
            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
              {session?.user.primaryRole === 'ADMIN' ? 'Amministratore' : 
               session?.user.primaryRole === 'FATTORINO' ? 'Fattorino' :
               session?.user.primaryRole === 'CUCINA' ? 'Cucina' : 'Sala'}
            </span>
          </div>
        </div>

        {/* Missing Hours Alert - Solo per dipendenti */}
        {!isAdmin && missingHours && missingHours.count > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-xl shadow-md overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-red-900 mb-1">
                    ⚠️ Ore Lavorate Mancanti
                  </h3>
                  <p className="text-sm sm:text-base text-red-800 mb-3">
                    Hai <span className="font-bold">{missingHours.count}</span> {missingHours.count === 1 ? 'turno' : 'turni'} per {missingHours.count === 1 ? 'il quale non hai' : 'i quali non hai'} ancora inserito le ore lavorate.
                  </p>
                  
                  {/* Mostra i primi turni mancanti */}
                  <div className="space-y-2 mb-4">
                    {missingHours.missingShifts.slice(0, 3).map((shift) => {
                      const shiftDate = new Date(shift.date)
                      
                      return (
                        <div key={shift.id} className="flex items-center justify-between p-2 sm:p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-red-200">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                              {getDayName(shift.dayOfWeek)} {format(shiftDate, 'dd/MM/yyyy')}
                            </p>
                            <p className="text-xs text-gray-600">
                              {shift.shiftType} - {getRoleName(shift.role as any)}
                            </p>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            <Clock className="h-4 w-4 text-red-500" />
                          </div>
                        </div>
                      )
                    })}
                    {missingHours.count > 3 && (
                      <p className="text-xs text-red-700 italic pl-2">
                        ... e altri {missingHours.count - 3} turni
                      </p>
                    )}
                  </div>

                  <a
                    href="/hours"
                    className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors shadow-sm text-sm"
                  >
                    Inserisci le Ore Mancanti
                    <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pending Hours Alert - Solo per admin */}
        {isAdmin && pendingHours && pendingHours.totalShifts > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-xl shadow-md overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-orange-900 mb-1">
                    ⏰ Ore Lavorate da Confermare
                  </h3>
                  <p className="text-sm sm:text-base text-orange-800 mb-3">
                    Ci {pendingHours.totalShifts === 1 ? 'è' : 'sono'} <span className="font-bold">{pendingHours.totalShifts}</span> {pendingHours.totalShifts === 1 ? 'turno' : 'turni'} di <span className="font-bold">{pendingHours.totalUsers}</span> {pendingHours.totalUsers === 1 ? 'dipendente' : 'dipendenti'} in attesa di conferma.
                  </p>
                  
                  {/* Mostra i primi utenti con ore in sospeso */}
                  <div className="space-y-2 mb-4">
                    {pendingHours.users.slice(0, 3).map((userPending) => (
                      <div key={userPending.user.id} className="flex items-center justify-between p-2 sm:p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-orange-200">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                            {userPending.user.username}
                          </p>
                          <p className="text-xs text-gray-600">
                            {userPending.shiftsCount} {userPending.shiftsCount === 1 ? 'turno' : 'turni'} • {userPending.totalHours.toFixed(2)} ore
                          </p>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          <Clock className="h-4 w-4 text-orange-500" />
                        </div>
                      </div>
                    ))}
                    {pendingHours.totalUsers > 3 && (
                      <p className="text-xs text-orange-700 italic pl-2">
                        ... e altri {pendingHours.totalUsers - 3} {pendingHours.totalUsers - 3 === 1 ? 'dipendente' : 'dipendenti'}
                      </p>
                    )}
                  </div>

                  <a
                    href="/admin/hours"
                    className="inline-flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors shadow-sm text-sm"
                  >
                    Conferma le Ore
                    <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chi lavora oggi - Minimalista */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Chi lavora oggi - {format(new Date(), 'EEEE d MMMM', { locale: it })}
            </h2>
          </div>
          
          {todayShifts && todayShifts.totalWorkers > 0 ? (
            <div className="space-y-6">
              {Object.entries(todayShifts.shifts)
                .sort(([a], [b]) => {
                  if (a === 'PRANZO' && b === 'CENA') return -1
                  if (a === 'CENA' && b === 'PRANZO') return 1
                  return 0
                })
                .map(([shiftType, shifts]) => {
                  const shiftsByRole = shifts.reduce((acc, shift) => {
                    if (!acc[shift.role]) acc[shift.role] = []
                    acc[shift.role].push(shift)
                    return acc
                  }, {} as Record<string, typeof shifts>)

                  return (
                    <div key={shiftType} className="border-l-4 border-gray-300 pl-4">
                      <h3 className="font-semibold text-gray-800 mb-3 uppercase text-sm">
                        {shiftType}
                          </h3>
                      
                      <div className="space-y-4">
                        {Object.entries(shiftsByRole).map(([role, roleShifts]) => (
                          <div key={role}>
                            <div className="text-xs font-semibold text-gray-600 mb-2 uppercase">
                              {getRoleName(role as Role)} ({roleShifts.length})
                              </div>
                            <div className="space-y-1">
                              {roleShifts.map((shift) => (
                                    <div 
                                      key={shift.id} 
                                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded hover:bg-gray-100 transition"
                                >
                                  <span className="text-sm font-medium text-gray-900">
                                            {shift.user.username}
                                  </span>
                                  <div className="flex items-center gap-3 text-xs text-gray-600">
                                    <span>{shift.startTime}</span>
                                            {role === 'FATTORINO' && shift.user.primaryTransport && (
                                      <span className="text-gray-400">
                                        {shift.user.primaryTransport === 'AUTO' ? '🚗' : '🏍️'}
                                      </span>
                                            )}
                                          </div>
                                        </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {todayShifts ? 'Nessuno lavora oggi' : 'Caricamento...'}
              </p>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {isAdmin ? (
            <>
              <StatCard
                title="Utenti Totali"
                value={stats.totalUsers || 0}
                icon={Users}
                color="blue"
                subtitle={`${stats.activeUsers || 0} attivi`}
              />
              <StatCard
                title="Turni Settimana"
                value={stats.totalShiftsThisWeek || 0}
                icon={Calendar}
                color="green"
                subtitle="Assegnati"
              />
              <StatCard
                title="Ore in Attesa"
                value={stats.pendingHours || 0}
                icon={Clock}
                color="yellow"
                subtitle="Da approvare"
              />
              <StatCard
                title="Sostituzioni"
                value={stats.pendingSubstitutions || 0}
                icon={UserCheck}
                color="purple"
                subtitle={`${stats.approvedSubstitutions || 0} approvate`}
              />
            </>
          ) : (
            <>
              <StatCard
                title="Ore Mese"
                value={`${(stats.myApprovedHours || 0).toFixed(1)}h`}
                icon={Clock}
                color="green"
                subtitle="Approvate"
              />
              <StatCard
                title="Ore Totali"
                value={`${(stats.myHoursThisMonth || 0).toFixed(1)}h`}
                icon={TrendingUp}
                color="orange"
                subtitle="Inserite"
              />
            </>
          )}
        </div>

        {/* Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-base sm:text-lg font-medium text-gray-900">
                {isAdmin ? 'Azioni Necessarie' : 'I Miei Prossimi Turni'}
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              {isAdmin ? (
                <div className="space-y-3">
                  {stats.pendingHours && stats.pendingHours > 0 ? (
                    <a
                      href="/admin/hours"
                      className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                        <div>
                          <p className="font-medium text-gray-900">Approva Ore</p>
                          <p className="text-sm text-gray-600">{stats.pendingHours} turni da approvare</p>
                        </div>
                      </div>
                      <span className="text-orange-600">→</span>
                    </a>
                  ) : null}
                  
                  {stats.pendingSubstitutions && stats.pendingSubstitutions > 0 ? (
                    <a
                      href="/admin/substitutions"
                      className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                        <div>
                          <p className="font-medium text-gray-900">Sostituzioni</p>
                          <p className="text-sm text-gray-600">{stats.pendingSubstitutions} richieste in attesa</p>
                        </div>
                      </div>
                      <span className="text-purple-600">→</span>
                    </a>
                  ) : null}
                  
                  {stats.totalAbsencesActive && stats.totalAbsencesActive > 0 ? (
                    <a
                      href="/admin/absences"
                      className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <div>
                          <p className="font-medium text-gray-900">Assenze Oggi</p>
                          <p className="text-sm text-gray-600">{stats.totalAbsencesActive} dipendenti assenti</p>
                        </div>
                      </div>
                      <span className="text-yellow-600">→</span>
                    </a>
                  ) : null}
                  
                  {(!stats.pendingHours || stats.pendingHours === 0) && 
                   (!stats.pendingSubstitutions || stats.pendingSubstitutions === 0) && 
                   (!stats.totalAbsencesActive || stats.totalAbsencesActive === 0) ? (
                    <div className="text-center py-8">
                      <CheckIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <p className="text-gray-700 font-medium">Tutto sotto controllo!</p>
                      <p className="text-sm text-gray-500 mt-1">Nessuna azione urgente richiesta</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                myShifts && myShifts.total > 0 ? (
                  <div className="space-y-2 sm:space-y-3">
                    {myShifts.shifts.map((shift) => (
                      <div
                        key={shift.id}
                        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border gap-2 ${
                          shift.isToday 
                            ? 'bg-orange-50 border-orange-200' 
                            : shift.isPast 
                            ? 'bg-gray-50 border-gray-200 opacity-75'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex-1">
                          <p className="text-sm sm:text-base font-medium text-gray-900">
                            {shift.dayName} {shift.date}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-600">
                            {shift.shiftType.toLowerCase()} - {getRoleName(shift.role as any)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between sm:block sm:text-right">
                          <p className="text-sm font-medium text-gray-900">
                            Inizio: {shift.startTime}
                          </p>
                          {shift.isToday && (
                            <p className="text-xs text-orange-600 font-medium">OGGI</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-700 text-center py-8">
                    Nessun turno assegnato per questa settimana
                  </p>
                )
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-medium text-gray-900">
                  {isAdmin ? 'Ore da Approvare' : 'Le Mie Ore'}
                </h2>
                {isAdmin && pendingHours && pendingHours.totalShifts > 0 && (
                  <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                    {pendingHours.totalShifts} turni
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 sm:p-6">
              {isAdmin ? (
                pendingHours && pendingHours.users.length > 0 ? (
                  <div className="space-y-2 sm:space-y-3">
                    {pendingHours.users.map((userPending) => (
                      <div 
                        key={userPending.user.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-orange-50 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors gap-2"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></div>
                          <div>
                            <p className="text-sm sm:text-base font-medium text-gray-900">
                              {userPending.user.username}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-600">
                              {getRoleName(userPending.user.primaryRole as any)}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right pl-5 sm:pl-0">
                          <p className="text-sm font-medium text-orange-800">
                            {userPending.shiftsCount} {userPending.shiftsCount === 1 ? 'turno' : 'turni'}
                          </p>
                          <p className="text-xs text-orange-600">
                            {userPending.totalHours}h totali
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <a 
                        href="/admin/hours"
                        className="block w-full text-center bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors font-medium"
                      >
                        Approva Tutte le Ore →
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-700">Nessuna ora in attesa di approvazione</p>
                  </div>
                )
              ) : (
                <p className="text-gray-700 text-center py-8">
                  Visualizza le tue ore lavorate nella sezione dedicata
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  subtitle 
}: { 
  title: string
  value: string | number
  icon: any
  color: string
  subtitle?: string
}) {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600', 
    yellow: 'text-yellow-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600'
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <Icon className={`h-6 w-6 sm:h-8 sm:w-8 ${colorClasses[color as keyof typeof colorClasses]}`} />
        </div>
        <div className="ml-3 sm:ml-4 flex-1">
          <h3 className="text-sm sm:text-lg font-medium text-gray-900">{title}</h3>
          <p className={`text-xl sm:text-2xl font-bold ${colorClasses[color as keyof typeof colorClasses]}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-700">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionButton({
  href,
  title,
  description,
  icon: Icon,
  highlight = false
}: {
  href: string
  title: string
  description: string
  icon: any
  highlight?: boolean
}) {
  return (
    <a
      href={href}
      className={`block p-3 sm:p-4 border rounded-lg transition-all ${
        highlight
          ? 'border-orange-400 bg-orange-50 hover:bg-orange-100 shadow-md ring-2 ring-orange-200'
          : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
      }`}
    >
      <div className="flex items-center mb-1 sm:mb-2">
        {highlight && (
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse mr-2"></div>
        )}
        <Icon className={`h-4 w-4 sm:h-5 sm:w-5 mr-2 ${highlight ? 'text-orange-700' : 'text-orange-600'}`} />
        <h3 className={`text-sm sm:text-base font-medium ${highlight ? 'text-orange-900' : 'text-gray-900'}`}>
          {title}
        </h3>
      </div>
      <p className={`text-xs sm:text-sm ${highlight ? 'text-orange-700' : 'text-gray-800'}`}>
        {description}
      </p>
    </a>
  )
}
