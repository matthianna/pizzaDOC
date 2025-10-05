'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { useSession } from 'next-auth/react'
import { Users, Calendar, Clock, BarChart3, UserCheck, TrendingUp, CalendarDays, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { getRoleName } from '@/lib/utils'

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
  const [loading, setLoading] = useState(true)

  const isAdmin = session?.user.roles.includes('ADMIN')

  useEffect(() => {
    fetchStats()
    fetchTodayShifts()
    if (!isAdmin && session) {
      fetchMyShifts()
    } else if (isAdmin && session) {
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
      const response = await fetch('/api/dashboard/pending-hours')
      if (response.ok) {
        const data = await response.json()
        setPendingHours(data)
      }
    } catch (error) {
      console.error('Error fetching pending hours:', error)
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

        {/* Chi lavora oggi */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center mb-4">
            <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500 mr-2" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              Chi lavora oggi - {format(new Date(), 'EEEE d MMMM', { locale: it })}
            </h2>
          </div>
          
          {todayShifts && todayShifts.totalWorkers > 0 ? (
            <div className="space-y-6">
              {Object.entries(todayShifts.shifts)
                .sort(([a], [b]) => {
                  // Ordina: PRANZO prima, CENA dopo
                  if (a === 'PRANZO' && b === 'CENA') return -1
                  if (a === 'CENA' && b === 'PRANZO') return 1
                  return 0
                })
                .map(([shiftType, shifts]) => {
                  // Raggruppa per ruolo
                  const shiftsByRole = shifts.reduce((acc, shift) => {
                    if (!acc[shift.role]) acc[shift.role] = []
                    acc[shift.role].push(shift)
                    return acc
                  }, {} as Record<string, typeof shifts>)

                  // Determina se il turno è terminato
                  const now = new Date()
                  const isShiftEnded = (shiftType === 'PRANZO' && now.getHours() >= 14) || 
                                      (shiftType === 'CENA' && now.getHours() >= 22)

                  return (
                    <div key={shiftType} className="border-l-4 border-orange-500 pl-4">
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="font-medium text-gray-900 capitalize text-lg">
                          {shiftType.toLowerCase()}
                        </h3>
                        {isShiftEnded && (
                          <span className="bg-gray-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                            TERMINATO
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {Object.entries(shiftsByRole).map(([role, roleShifts]) => (
                          <div key={role}>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                              {getRoleName(role as Role)}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                              {roleShifts.map((shift) => (
                                <div 
                                  key={shift.id} 
                                  className={`rounded-lg p-2 sm:p-3 border transition-all ${
                                    isShiftEnded 
                                      ? 'bg-gray-100 border-gray-300 opacity-75' 
                                      : 'bg-orange-50 border-orange-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className={`font-medium ${
                                        isShiftEnded ? 'text-gray-600' : 'text-gray-900'
                                      }`}>
                                        {shift.user.username}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-sm font-medium ${
                                        isShiftEnded ? 'text-gray-500' : 'text-gray-900'
                                      }`}>
                                        Inizio: {shift.startTime}
                                      </p>
                                    </div>
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
              <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-700">
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
                title="Turni Settimana"
                value={stats.myShiftsThisWeek || 0}
                icon={Calendar}
                color="blue"
                subtitle="Assegnati"
              />
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
                title="Sostituzioni"
                value={stats.myPendingSubstitutions || 0}
                icon={UserCheck}
                color="purple"
                subtitle="In attesa"
              />
            </>
          )}
        </div>

        {/* Additional Admin Stats */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <StatCard
              title="Assenze Attive"
              value={stats.totalAbsencesActive || 0}
              icon={AlertCircle}
              color="orange"
              subtitle="In corso oggi"
            />
            <StatCard
              title="Disponibilità"
              value={stats.availabilitiesThisWeek || 0}
              icon={Calendar}
              color="green"
              subtitle="Questa settimana"
            />
            <StatCard
              title="Piani Generati"
              value={stats.thisWeekSchedules || 0}
              icon={BarChart3}
              color="blue"
              subtitle="Settimana corrente"
            />
          </div>
        )}

        {/* Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                {isAdmin ? 'Attività Recenti' : 'I Miei Prossimi Turni'}
              </h2>
            </div>
            <div className="p-6">
              {isAdmin ? (
                <p className="text-gray-700 text-center py-8">
                  Nessuna attività recente
                </p>
              ) : (
                myShifts && myShifts.total > 0 ? (
                  <div className="space-y-3">
                    {myShifts.shifts.map((shift) => (
                      <div
                        key={shift.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          shift.isToday 
                            ? 'bg-orange-50 border-orange-200' 
                            : shift.isPast 
                            ? 'bg-gray-50 border-gray-200 opacity-75'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {shift.dayName} {shift.date}
                          </p>
                          <p className="text-sm text-gray-600">
                            {shift.shiftType.toLowerCase()} - {getRoleName(shift.role as any)}
                          </p>
                        </div>
                        <div className="text-right">
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
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">
                  {isAdmin ? 'Ore da Approvare' : 'Le Mie Ore'}
                </h2>
                {isAdmin && pendingHours && pendingHours.totalShifts > 0 && (
                  <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                    {pendingHours.totalShifts} turni
                  </span>
                )}
              </div>
            </div>
            <div className="p-6">
              {isAdmin ? (
                pendingHours && pendingHours.users.length > 0 ? (
                  <div className="space-y-3">
                    {pendingHours.users.map((userPending) => (
                      <div 
                        key={userPending.user.id}
                        className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {userPending.user.username}
                            </p>
                            <p className="text-sm text-gray-600">
                              {getRoleName(userPending.user.primaryRole as any)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
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

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Azioni Rapide</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isAdmin ? (
              <>
                <ActionButton
                  href="/admin/users"
                  title="Gestisci Utenti"
                  description="Crea e modifica utenti del sistema"
                  icon={Users}
                />
                <ActionButton
                  href="/admin/schedule"
                  title="Piano Lavoro"
                  description="Genera il piano settimanale"
                  icon={Calendar}
                />
                <ActionButton
                  href="/admin/hours"
                  title="Approva Ore"
                  description="Gestisci le ore lavorate"
                  icon={Clock}
                />
              </>
            ) : (
              <>
                <ActionButton
                  href="/availability"
                  title="Disponibilità"
                  description="Aggiorna la tua disponibilità"
                  icon={Calendar}
                />
                <ActionButton
                  href="/hours"
                  title="Ore Lavorate"
                  description="Inserisci le tue ore"
                  icon={Clock}
                />
                <ActionButton
                  href="/substitutions"
                  title="Sostituzioni"
                  description="Gestisci sostituzioni"
                  icon={UserCheck}
                />
              </>
            )}
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
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <Icon className={`h-8 w-8 ${colorClasses[color as keyof typeof colorClasses]}`} />
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <p className={`text-2xl font-bold ${colorClasses[color as keyof typeof colorClasses]}`}>
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
  icon: Icon
}: {
  href: string
  title: string
  description: string
  icon: any
}) {
  return (
    <a
      href={href}
      className="block p-4 border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
    >
      <div className="flex items-center mb-2">
        <Icon className="h-5 w-5 text-orange-600 mr-2" />
        <h3 className="font-medium text-gray-900">{title}</h3>
      </div>
      <p className="text-sm text-gray-800">{description}</p>
    </a>
  )
}
