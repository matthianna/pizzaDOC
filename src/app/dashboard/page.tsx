'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { useSession } from 'next-auth/react'
import {
  Users, Calendar, Clock, BarChart3, UserCheck, TrendingUp, CalendarDays,
  AlertCircle, Settings, Shield, CheckIcon, Bike, Car, UtensilsCrossed,
  ChefHat, Pizza, Plus, ArrowRight
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { getRoleName, getDayName } from '@/lib/utils'
import type { Role } from '@prisma/client'
import { useHaptics } from '@/hooks/use-haptics'

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
  const { lightClick } = useHaptics()

  const isAdminUser = session?.user.roles.includes('ADMIN')

  useEffect(() => {
    if (!session) return

    fetchStats()
    fetchTodayShifts()
    if (!isAdminUser) {
      fetchMyShifts()
      fetchMissingHours()
    } else {
      fetchPendingHours()
    }
  }, [session, isAdminUser])

  const fetchTodayShifts = async () => {
    try {
      const response = await fetch('/api/dashboard/today-shifts')
      if (response.ok) {
        const data = await response.json()
        setTodayShifts(data)
      } else {
        setTodayShifts({
          date: new Date().toISOString(),
          dayOfWeek: 0,
          shifts: {},
          totalWorkers: 0
        })
      }
    } catch (error) {
      console.error('Error fetching today shifts:', error)
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
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/dashboard/pending-hours?_t=${timestamp}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      })
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
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/dashboard/missing-hours?_t=${timestamp}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      })
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
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg p-5 sm:p-8 text-white">
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Ciao, {session?.user.username}! 👋
            </h1>
            <p className="text-orange-100 mt-1 text-sm sm:text-base font-medium">
              Speriamo tu stia passando una splendida giornata.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
              <Shield className="h-3 w-3" />
              {session?.user.primaryRole === 'ADMIN' ? 'Amministratore' :
                session?.user.primaryRole === 'FATTORINO' ? 'Fattorino' :
                  session?.user.primaryRole === 'CUCINA' ? 'Cucina' : 'Sala'}
            </div>
          </div>
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-24 h-24 bg-orange-400/20 rounded-full blur-xl"></div>
        </div>

        {/* Missing Hours Alert */}
        {!isAdminUser && missingHours && missingHours.count > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-xl shadow-md overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-red-900">⚠️ Ore Mancanti</h3>
                  <p className="text-sm text-red-800 mb-3">Hai {missingHours.count} turni senza ore inserite.</p>
                  <a href="/hours" onClick={() => lightClick()} className="inline-flex items-center px-4 py-2 bg-red-600 text-white font-semibold rounded-lg text-sm shadow-sm active:scale-95 transition-transform">
                    Inserisci Ore <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pending Approval Alert */}
        {isAdminUser && pendingHours && pendingHours.totalShifts > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-xl shadow-md overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-orange-900">⏰ Approvazioni Ore</h3>
                  <p className="text-sm text-orange-800 mb-3">{pendingHours.totalShifts} turni da confermare.</p>
                  <a href="/admin/hours" onClick={() => lightClick()} className="inline-flex items-center px-4 py-2 bg-orange-600 text-white font-semibold rounded-lg text-sm shadow-sm active:scale-95 transition-transform">
                    Approva Ora <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isAdminUser ? (
            <>
              <QuickActionCard href="/admin/schedule" title="Gestisci Piano" icon={CalendarDays} color="blue" onClick={lightClick} />
              <QuickActionCard href="/admin/hours" title="Approva Ore" icon={CheckIcon} color="orange" badge={pendingHours?.totalShifts} onClick={lightClick} />
              <QuickActionCard href="/admin/users" title="Utenti" icon={Users} color="green" onClick={lightClick} />
              <QuickActionCard href="/admin/system" title="Sistema" icon={Settings} color="gray" onClick={lightClick} />
            </>
          ) : (
            <>
              <QuickActionCard href="/hours" title="Segna Ore" icon={Clock} color="orange" badge={missingHours?.count} onClick={lightClick} />
              <QuickActionCard href="/schedule" title="Mio Piano" icon={CalendarDays} color="blue" onClick={lightClick} />
              <QuickActionCard href="/substitution-requests" title="Sostituzioni" icon={UserCheck} color="purple" onClick={lightClick} />
              <QuickActionCard href="/availability" title="Disponibilità" icon={Calendar} color="green" onClick={lightClick} />
            </>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isAdminUser ? (
            <>
              <StatCard title="Utenti" value={stats.totalUsers || 0} icon={Users} color="blue" subtitle={`${stats.activeUsers || 0} attivi`} />
              <StatCard title="Turni" value={stats.totalShiftsThisWeek || 0} icon={Calendar} color="green" subtitle="Settimana" />
              <StatCard title="Ore Attesa" value={stats.pendingHours || 0} icon={Clock} color="yellow" subtitle="Da approvare" />
              <StatCard title="Sostituzioni" value={stats.pendingSubstitutions || 0} icon={UserCheck} color="purple" subtitle="In attesa" />
            </>
          ) : (
            <>
              <StatCard title="Ore Mese" value={`${(stats.myApprovedHours || 0).toFixed(1)}h`} icon={Clock} color="green" subtitle="Approvate" />
              <StatCard title="Ore Totali" value={`${(stats.myHoursThisMonth || 0).toFixed(1)}h`} icon={TrendingUp} color="orange" subtitle="Inserite" />
              <StatCard title="Turni" value={stats.myShiftsThisWeek || 0} icon={Calendar} color="blue" subtitle="Questa sett." />
              <StatCard title="Sostituzioni" value={stats.myPendingSubstitutions || 0} icon={UserCheck} color="purple" subtitle="In attesa" />
            </>
          )}
        </div>

        {/* Bottom Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chi lavora oggi */}
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-600" /> Chi lavora oggi
                </h2>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">{format(new Date(), 'EEEE d MMMM', { locale: it })}</p>
              </div>
            </div>
            <div className="p-4 flex-1">
              {todayShifts && todayShifts.totalWorkers > 0 ? (
                <div className="space-y-6">
                  {Object.entries(todayShifts.shifts)
                    .sort(([a], [b]) => (a === 'PRANZO' ? -1 : 1))
                    .map(([type, shifts]) => (
                      <div key={type}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`${type === 'PRANZO' ? 'bg-yellow-100 text-yellow-800' : 'bg-indigo-100 text-indigo-800'} px-2 py-0.5 rounded text-[10px] font-black uppercase`}>
                            {type}
                          </span>
                          <div className="h-px bg-gray-100 flex-1"></div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {shifts.map((s) => (
                            <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{s.user.username}</p>
                                <p className="text-[10px] text-gray-500 font-bold uppercase">{getRoleName(s.role as Role)}</p>
                              </div>
                              <span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded-lg border border-gray-100">{s.startTime}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Pizza className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-bold">Nessun turno oggi</p>
                </div>
              )}
            </div>
          </div>

          {/* User's Next Shifts or Admin Action */}
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">{isAdminUser ? 'Admin Task' : 'I Miei Turni'}</h2>
            </div>
            <div className="p-4">
              {!isAdminUser && myShifts && myShifts.total > 0 ? (
                <div className="space-y-3">
                  {myShifts.shifts.map((s) => (
                    <div key={s.id} className={`flex items-center justify-between p-3 rounded-2xl border ${s.isToday ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-bold ${s.isToday ? 'bg-orange-500 text-white shadow-glow-orange' : 'bg-gray-100 text-gray-500'}`}>
                          <span className="text-[10px] uppercase leading-none">{s.dayName.substring(0, 3)}</span>
                          <span className="text-sm leading-none mt-0.5">{format(new Date(s.date), 'd')}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{s.shiftType} - {getRoleName(s.role as Role)}</p>
                          <p className="text-xs text-gray-500">{s.startTime} - {s.endTime}</p>
                        </div>
                      </div>
                      {s.isToday && <span className="text-[10px] font-black text-white bg-orange-600 px-2 py-0.5 rounded-full">OGGI</span>}
                    </div>
                  ))}
                </div>
              ) : isAdminUser ? (
                <div className="space-y-3">
                  <AdminTaskItem href="/admin/substitutions" title="Approvazione Sostituzioni" count={stats.pendingSubstitutions} color="purple" onClick={lightClick} />
                  <AdminTaskItem href="/admin/hours" title="Conferma Ore Lavorate" count={stats.pendingHours} color="orange" onClick={lightClick} />
                </div>
              ) : (
                <div className="text-center py-10">
                  <Calendar className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-bold">Nessun turno assegnato</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

function QuickActionCard({ href, title, icon: Icon, color, onClick, badge }: any) {
  const colorClasses: any = {
    blue: 'bg-blue-100 text-blue-600',
    orange: 'bg-orange-100 text-orange-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    gray: 'bg-gray-100 text-gray-600'
  }
  return (
    <a href={href} onClick={onClick} className="relative flex flex-col items-center justify-center p-4 sm:p-6 bg-white rounded-2xl shadow-soft border border-gray-100 active:scale-95 transition-all touch-active group">
      {badge > 0 && <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">{badge}</span>}
      <div className={`p-3 rounded-xl mb-3 ${colorClasses[color]} group-hover:scale-110 transition-transform`}>
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-xs font-bold text-gray-900 text-center">{title}</span>
    </a>
  )
}

function StatCard({ title, value, icon: Icon, color, subtitle }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600'
  }
  return (
    <div className="bg-white rounded-2xl p-4 shadow-soft border border-gray-50 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</h3>
        <div className={`p-1.5 rounded-lg ${colors[color]}`}><Icon className="h-3.5 w-3.5" /></div>
      </div>
      <p className="text-xl font-black text-gray-900 leading-tight">{value}</p>
      {subtitle && <p className="mt-1 text-[10px] font-bold text-gray-500">{subtitle}</p>}
      <div className={`absolute -bottom-4 -right-4 w-12 h-12 rounded-full opacity-5 ${colors[color].split(' ')[0]}`}></div>
    </div>
  )
}

function AdminTaskItem({ href, title, count, color, onClick }: any) {
  if (!count || count === 0) return null
  const c: any = {
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700'
  }
  return (
    <a href={href} onClick={onClick} className={`flex items-center justify-between p-3 rounded-2xl border transition-colors hover:brightness-95 active:scale-[0.98] ${c[color]}`}>
      <span className="text-sm font-bold">{title}</span>
      <span className="text-xs font-black bg-white/50 px-2 py-0.5 rounded-full">{count}</span>
    </a>
  )
}
