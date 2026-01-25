'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { useSession } from 'next-auth/react'
import {
  Users, Calendar, Clock, BarChart3, UserCheck, TrendingUp, CalendarDays,
  AlertCircle, Settings, Shield, CheckIcon, Bike, UtensilsCrossed,
  ChefHat, Pizza, ArrowRight, UserPlus
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { getRoleName, getDayName, cn } from '@/lib/utils'
import type { Role } from '@prisma/client'
import { useHaptics } from '@/hooks/use-haptics'
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton'

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
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-8 max-w-6xl mx-auto pb-20 px-2 sm:px-4">
        {/* Welcome Section - More compact and premium */}
        <div className="relative overflow-hidden bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-soft border border-gray-100 group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60 group-hover:scale-110 transition-transform duration-700"></div>
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-orange-100 transform -rotate-3 group-hover:rotate-0 transition-transform duration-500">
                <span className="text-white font-black text-2xl sm:text-3xl">
                  {session?.user.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight leading-none">
                  Ciao, {session?.user.username}!
                </h1>
                <div className="flex items-center gap-2 mt-3">
                  <span className="px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-orange-100">
                    {isAdminUser ? 'Amministratore' : getRoleName(session?.user.primaryRole || 'USER')}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                    {format(new Date(), 'EEEE d MMMM', { locale: it })}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Summary Circle Stats */}
            <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-gray-50 pt-6 md:pt-0 md:pl-8">
              {isAdminUser ? (
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">In Sospeso</p>
                    <p className="text-2xl font-black text-orange-600">{pendingHours?.totalShifts || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Attivi</p>
                    <p className="text-2xl font-black text-green-600">{stats.activeUsers || 0}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ore Mese</p>
                    <p className="text-2xl font-black text-blue-600">{(stats.myApprovedHours || 0).toFixed(1)}h</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Turni</p>
                    <p className="text-2xl font-black text-orange-600">{stats.myShiftsThisWeek || 0}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 🚀 LIVE: Chi lavora oggi - High Priority Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Chi lavora oggi • {format(new Date(), 'dd/MM')}
            </h2>
            {isAdminUser && (
              <a href="/admin/schedule" className="text-[10px] font-black text-orange-600 uppercase tracking-widest hover:underline">
                Vedi Piano Completo →
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {todayShifts && (todayShifts.shifts['PRANZO']?.length > 0 || todayShifts.shifts['CENA']?.length > 0) ? (
              <>
                {['PRANZO', 'CENA'].map((type) => {
                  const shifts = todayShifts.shifts[type] || []
                  if (shifts.length === 0) return null
                  
                  return (
                    <div key={type} className="bg-white rounded-[2rem] shadow-soft border border-gray-100 overflow-hidden">
                      <div className={cn(
                        "px-6 py-4 border-b border-gray-50 flex items-center justify-between",
                        type === 'PRANZO' ? "bg-orange-50/30" : "bg-indigo-50/30"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center shadow-sm",
                            type === 'PRANZO' ? "bg-orange-100 text-orange-600" : "bg-indigo-100 text-indigo-600"
                          )}>
                            {type === 'PRANZO' ? <Pizza className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
                          </div>
                          <span className={cn(
                            "text-xs font-black uppercase tracking-[0.2em]",
                            type === 'PRANZO' ? "text-orange-700" : "text-indigo-700"
                          )}>
                            Turno {type}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {shifts.length} {shifts.length === 1 ? 'Persona' : 'Persone'}
                        </span>
                      </div>
                      <div className="p-4 grid grid-cols-1 gap-2">
                        {shifts.map((s) => (
                          <div key={s.id} className="group flex items-center justify-between p-3 bg-white border border-gray-100 rounded-2xl hover:border-orange-200 hover:shadow-md transition-all duration-300">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                                {s.role === 'FATTORINO' ? <Bike className="h-5 w-5" /> : 
                                 s.role === 'CUCINA' ? <ChefHat className="h-5 w-5" /> : 
                                 <UserCheck className="h-5 w-5" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-gray-900 truncate leading-none">
                                  {s.user.username}
                                </p>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                                  {getRoleName(s.role as Role)}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-black text-gray-900 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                                {s.startTime}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              <div className="col-span-full bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200 py-12 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Calendar className="h-8 w-8 text-gray-200" />
                </div>
                <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Nessun turno programmato per oggi</p>
              </div>
            )}
          </div>
        </div>

        {/* Alerts & Critical Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notifications / Alerts - Col span 2 */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] px-2 flex items-center gap-3">
              Azioni Richieste
            </h2>
            
            <div className="grid grid-cols-1 gap-4">
              {/* Admin: Approvals */}
              {isAdminUser && pendingHours && pendingHours.totalShifts > 0 && (
                <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 to-orange-600 rounded-[2rem] p-6 shadow-lg shadow-orange-100 group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Clock className="h-20 w-20 text-white" />
                  </div>
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                      <h3 className="text-white text-xl font-black tracking-tight">Approvazione Ore</h3>
                      <p className="text-orange-100 text-sm font-medium mt-1">
                        Ci sono {pendingHours.totalShifts} turni in attesa di essere confermati.
                      </p>
                    </div>
                    <a href="/admin/hours" onClick={() => lightClick()} className="bg-white text-orange-600 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all text-center">
                      Approva Ora
                    </a>
                  </div>
                </div>
              )}

              {/* User: Missing Hours */}
              {!isAdminUser && missingHours && missingHours.count > 0 && (
                <div className="relative overflow-hidden bg-gradient-to-r from-red-500 to-red-600 rounded-[2rem] p-6 shadow-lg shadow-red-100 group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <AlertCircle className="h-20 w-20 text-white" />
                  </div>
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                      <h3 className="text-white text-xl font-black tracking-tight">Ore Mancanti</h3>
                      <p className="text-red-100 text-sm font-medium mt-1">
                        Hai {missingHours.count} turni senza ore inserite. Completali subito!
                      </p>
                    </div>
                    <a href="/hours" onClick={() => lightClick()} className="bg-white text-red-600 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all text-center">
                      Inserisci Ore
                    </a>
                  </div>
                </div>
              )}

              {/* Admin Task: Substitutions */}
              {isAdminUser && typeof stats.pendingSubstitutions === 'number' && stats.pendingSubstitutions > 0 && (
                <div className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-6 group hover:border-purple-200 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                      <UserPlus className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-gray-900 font-black tracking-tight uppercase text-sm">Sostituzioni</h3>
                      <p className="text-gray-400 text-xs font-medium mt-0.5">{stats.pendingSubstitutions} richieste da approvare</p>
                    </div>
                  </div>
                  <a href="/admin/substitutions" className="px-6 py-3 bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-purple-100 active:scale-95 transition-all text-center">
                    Gestisci
                  </a>
                </div>
              )}

              {/* Quick Actions for everyone else */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {isAdminUser ? (
                  <>
                    <QuickActionItem href="/admin/users" title="Utenti" icon={Users} color="blue" />
                    <QuickActionItem href="/admin/holidays" title="Festivi" icon={CalendarDays} color="red" />
                    <QuickActionItem href="/admin/hours-summary" title="Riepilogo" icon={BarChart3} color="green" />
                    <QuickActionItem href="/admin/system" title="Sistema" icon={Settings} color="gray" />
                  </>
                ) : (
                  <>
                    <QuickActionItem href="/hours" title="Le Mie Ore" icon={Clock} color="orange" />
                    <QuickActionItem href="/schedule" title="Mio Piano" icon={CalendarDays} color="blue" />
                    <QuickActionItem href="/substitution-requests" title="Cambio Turno" icon={UserPlus} color="purple" />
                    <QuickActionItem href="/availability" title="Disponibilità" icon={Calendar} color="green" />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Secondary Section - Personal Info */}
          <div className="space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] px-2 flex items-center gap-3">
              {isAdminUser ? 'Info Settimanali' : 'I Miei Prossimi Turni'}
            </h2>
            
            <div className="bg-white rounded-[2.5rem] shadow-soft border border-gray-100 p-6 flex-1 min-h-[300px]">
              {isAdminUser ? (
                <div className="space-y-6">
                  <DashboardStatItem label="Utenti Attivi" value={stats.activeUsers || 0} icon={Users} color="green" />
                  <DashboardStatItem label="Turni della Settimana" value={stats.totalShiftsThisWeek || 0} icon={CalendarDays} color="blue" />
                  <DashboardStatItem label="Disponibilità Inserite" value={stats.availabilitiesThisWeek || 0} icon={UserCheck} color="orange" />
                  <DashboardStatItem label="Sostituzioni Approvate" value={stats.approvedSubstitutions || 0} icon={CheckIcon} color="purple" />
                </div>
              ) : (
                <div className="space-y-4">
                  {myShifts && myShifts.shifts.length > 0 ? (
                    myShifts.shifts.slice(0, 5).map((s) => (
                      <div key={s.id} className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-all duration-300",
                        s.isToday ? "bg-orange-50 border-orange-200 shadow-sm" : "bg-white border-gray-50 hover:border-orange-100"
                      )}>
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black",
                            s.isToday ? "bg-orange-600 text-white shadow-lg shadow-orange-100" : "bg-gray-50 text-gray-400"
                          )}>
                            <span className="text-[9px] uppercase leading-none">{s.dayName.substring(0, 3)}</span>
                            <span className="text-lg leading-none mt-1">{format(new Date(s.date), 'd')}</span>
                          </div>
                          <div>
                            <p className="text-xs font-black text-gray-900 uppercase tracking-tight">{s.shiftType}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{getRoleName(s.role as Role)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-gray-900">{s.startTime}</p>
                          {s.isToday && <span className="inline-block mt-1 w-1.5 h-1.5 rounded-full bg-orange-500" />}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Calendar className="h-12 w-12 text-gray-100 mb-4" />
                      <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Nessun turno assegnato</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

function QuickActionItem({ href, title, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    gray: 'bg-gray-50 text-gray-600 border-gray-100'
  }
  return (
    <a href={href} className="flex flex-col items-center gap-3 group">
      <div className={cn(
        "w-full aspect-square rounded-3xl flex items-center justify-center border-2 transition-all duration-300 group-active:scale-90 group-hover:shadow-lg shadow-gray-100",
        colors[color] || colors.gray
      )}>
        <Icon className="h-6 w-6 sm:h-7 sm:w-7 group-hover:scale-110 transition-transform" />
      </div>
      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">{title}</span>
    </a>
  )
}

function DashboardStatItem({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600'
  }
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-xl font-black text-gray-900">{value}</span>
    </div>
  )
}
