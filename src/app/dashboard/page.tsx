'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { useSession } from 'next-auth/react'
import { Users, Calendar, Clock, BarChart3, UserCheck, TrendingUp, CalendarDays } from 'lucide-react'
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

export default function DashboardPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats>({})
  const [todayShifts, setTodayShifts] = useState<TodayShiftsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    fetchTodayShifts()
  }, [])

  const fetchTodayShifts = async () => {
    try {
      const response = await fetch('/api/dashboard/today-shifts')
      if (response.ok) {
        const data = await response.json()
        setTodayShifts(data)
      }
    } catch (error) {
      console.error('Error fetching today shifts:', error)
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

  const isAdmin = session?.user.roles.includes('ADMIN')

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
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Benvenuto, {session?.user.username}!
          </h1>
          <p className="text-gray-800 mt-2">
            Dashboard - Sistema di gestione piano di lavoro pizzeria
          </p>
          <div className="mt-4 flex items-center text-sm text-gray-700">
            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
              {session?.user.primaryRole === 'ADMIN' ? 'Amministratore' : 
               session?.user.primaryRole === 'FATTORINO' ? 'Fattorino' :
               session?.user.primaryRole === 'CUCINA' ? 'Cucina' : 'Sala'}
            </span>
          </div>
        </div>

        {/* Chi lavora oggi */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <CalendarDays className="h-6 w-6 text-orange-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">
              Chi lavora oggi - {format(new Date(), 'EEEE d MMMM', { locale: it })}
            </h2>
          </div>
          
          {todayShifts && todayShifts.totalWorkers > 0 ? (
            <div className="space-y-4">
              {Object.entries(todayShifts.shifts).map(([shiftType, shifts]) => (
                <div key={shiftType} className="border-l-4 border-orange-500 pl-4">
                  <h3 className="font-medium text-gray-900 mb-2 capitalize">
                    {shiftType.toLowerCase()}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {shifts.map((shift) => (
                      <div 
                        key={shift.id} 
                        className="bg-orange-50 rounded-lg p-3 border border-orange-200"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {shift.user.username}
                            </p>
                            <p className="text-sm text-orange-600">
                              {getRoleName(shift.role as any)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {shift.startTime} - {shift.endTime}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                subtitle="In attesa"
              />
              <StatCard
                title="Piani Settimana"
                value={stats.thisWeekSchedules || 0}
                icon={Calendar}
                color="green"
                subtitle="Generati"
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

        {/* Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                {isAdmin ? 'Attività Recenti' : 'I Miei Prossimi Turni'}
              </h2>
            </div>
            <div className="p-6">
              <p className="text-gray-700 text-center py-8">
                {isAdmin ? 
                  'Nessuna attività recente' : 
                  'Nessun turno assegnato per questa settimana'
                }
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                {isAdmin ? 'Ore da Approvare' : 'Le Mie Ore'}
              </h2>
            </div>
            <div className="p-6">
              <p className="text-gray-700 text-center py-8">
                {isAdmin ?
                  stats.pendingHours === 0 ? 'Nessuna ora in attesa di approvazione' : `${stats.pendingHours} ore da approvare` :
                  'Visualizza le tue ore lavorate nella sezione dedicata'
                }
              </p>
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
