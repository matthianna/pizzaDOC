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

        {/* Quick Actions - Mobile Only */}
        {!isAdmin && (
          <div className="grid grid-cols-2 gap-3 sm:hidden">
            <a href="/hours" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-transform">
              <div className="p-3 bg-orange-100 rounded-full mb-2">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <span className="text-sm font-medium text-gray-900">Segna Ore</span>
            </a>
            <a href="/schedule" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-transform">
              <div className="p-3 bg-blue-100 rounded-full mb-2">
                <CalendarDays className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-900">Mio Piano</span>
            </a>
            <a href="/substitution-requests" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-transform">
              <div className="p-3 bg-purple-100 rounded-full mb-2">
                <UserCheck className="h-6 w-6 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-900">Sostituzioni</span>
            </a>
            <a href="/availability" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-transform">
              <div className="p-3 bg-green-100 rounded-full mb-2">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-900">Disponibilità</span>
            </a>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {isAdmin ? (
            <>
              <StatCard
                title="Utenti"
                value={stats.totalUsers || 0}
                icon={Users}
                color="blue"
                subtitle={`${stats.activeUsers || 0} attivi`}
              />
              <StatCard
                title="Turni"
                value={stats.totalShiftsThisWeek || 0}
                icon={Calendar}
                color="green"
                subtitle="Settimana"
              />
              <StatCard
                title="Ore Attesa"
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
                subtitle="In attesa"
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
              <StatCard
                title="Turni"
                value={stats.myShiftsThisWeek || 0}
                icon={Calendar}
                color="blue"
                subtitle="Questa sett."
              />
              <StatCard
                title="Sostituzioni"
                value={stats.myPendingSubstitutions || 0}
                icon={UserCheck}
                color="purple"
                subtitle="In attesa"
              />
            </>
          )}
        </div>

        {/* Recent Activities & Chi lavora oggi */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Chi lavora oggi */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-orange-600" />
                Chi lavora oggi
              </h2>
              <p className="text-sm text-gray-500">
                {format(new Date(), 'EEEE d MMMM', { locale: it })}
              </p>
            </div>

            <div className="p-4">
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
                        <div key={shiftType}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${shiftType === 'PRANZO' ? 'bg-yellow-100 text-yellow-800' : 'bg-indigo-100 text-indigo-800'
                              }`}>
                              {shiftType}
                            </span>
                            <div className="h-px bg-gray-100 flex-1"></div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {Object.entries(shiftsByRole).map(([role, roleShifts]) => (
                              <div key={role} className="bg-gray-50 rounded-lg p-3">
                                <div className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                  {role === 'FATTORINO' && <Bike className="h-3 w-3" />}
                                  {role === 'CUCINA' && <ChefHat className="h-3 w-3" />}
                                  {role === 'SALA' && <UtensilsCrossed className="h-3 w-3" />}
                                  {getRoleName(role as Role)}
                                </div>
                                <div className="space-y-2">
                                  {roleShifts.map((shift) => (
                                    <div key={shift.id} className="flex items-center justify-between bg-white p-2 rounded border border-gray-100 shadow-sm">
                                      <span className="text-sm font-medium text-gray-900 truncate mr-2">
                                        {shift.user.username}
                                      </span>
                                      <div className="flex items-center gap-2 text-xs text-gray-500 whitespace-nowrap">
                                        <span>{shift.startTime}</span>
                                        {role === 'FATTORINO' && shift.user.primaryTransport && (
                                          <span>
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
                  <div className="bg-gray-50 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                    <Pizza className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">
                    {todayShifts ? 'Nessun turno oggi' : 'Caricamento...'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* I Miei Prossimi Turni / Azioni Necessarie */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">
                {isAdmin ? 'Azioni Necessarie' : 'I Miei Prossimi Turni'}
              </h2>
            </div>
            <div className="p-4">
              {isAdmin ? (
                <div className="space-y-3">
                  {stats.pendingHours && stats.pendingHours > 0 ? (
                    <a
                      href="/admin/hours"
                      className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
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
                      className="flex items-center justify-between p-3 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-colors"
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
                      className="flex items-center justify-between p-3 rounded-xl bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 transition-colors"
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
                  <div className="space-y-3">
                    {myShifts.shifts.map((shift) => (
                      <div
                        key={shift.id}
                        className={`flex items-center justify-between p-3 rounded-xl border ${shift.isToday
                            ? 'bg-orange-50 border-orange-200 shadow-sm'
                            : shift.isPast
                              ? 'bg-gray-50 border-gray-200 opacity-75'
                              : 'bg-white border-gray-100 shadow-sm'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg ${shift.isToday ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                            <span className="text-xs font-bold uppercase">{shift.dayName.substring(0, 3)}</span>
                            <span className="text-sm font-bold">{format(new Date(shift.date), 'd')}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {shift.shiftType} - {getRoleName(shift.role as any)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {shift.startTime} - {shift.endTime}
                            </p>
                          </div>
                        </div>
                        {shift.isToday && (
                          <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                            OGGI
                          </span>
                        )}
                      </div>
                    ))}
                    <a href="/schedule" className="block text-center text-sm text-orange-600 font-medium mt-2 hover:underline">
                      Vedi tutto il piano →
                    </a>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">
                      Nessun turno assegnato per questa settimana
                    </p>
                  </div>
                )
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
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    purple: 'text-purple-600 bg-purple-50',
    orange: 'text-orange-600 bg-orange-50'
  }

  const baseColor = color as keyof typeof colorClasses

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{value}</h3>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-2 rounded-lg ${colorClasses[baseColor]}`}>
          <Icon className="h-5 w-5" />
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
      className={`block p-3 sm:p-4 border rounded-lg transition-all ${highlight
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
