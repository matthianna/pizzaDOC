'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { useSession } from 'next-auth/react'
import {
  Users, Calendar, Clock, BarChart3, UserCheck, TrendingUp, CalendarDays,
  AlertCircle, Settings, Shield, CheckIcon, Bike, UtensilsCrossed,
  ChefHat, Pizza, ArrowRight, UserPlus, Sparkles
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { getRoleName, getDayName, cn } from '@/lib/utils'
import type { Role } from '@prisma/client'
import { useHaptics } from '@/hooks/use-haptics'
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton'
import { WeatherWidget } from '@/components/weather/weather-widget'
import { NotificationPermissionPrompt } from '@/components/notifications/notification-permission-prompt'
import { formatDecimalHoursIt } from '@/lib/format-hours-display'

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

interface TodayHoliday {
  id: string
  closureType: string
  description: string | null
}

interface TodayShiftsData {
  date: string
  dayOfWeek: number
  shifts: Record<string, TodayShift[]>
  totalWorkers: number
  holidays?: TodayHoliday[]
  isPranzoClosed?: boolean
  isCenaClosed?: boolean
  isFullClosure?: boolean
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
      const response = await fetch('/api/dashboard/today-shifts', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setTodayShifts(data)
      } else {
        setTodayShifts({
          date: new Date().toISOString(),
          dayOfWeek: 0,
          shifts: {},
          totalWorkers: 0,
          holidays: [],
          isPranzoClosed: false,
          isCenaClosed: false,
          isFullClosure: false,
        })
      }
    } catch (error) {
      console.error('Error fetching today shifts:', error)
      setTodayShifts({
        date: new Date().toISOString(),
        dayOfWeek: 0,
        shifts: {},
        totalWorkers: 0,
        holidays: [],
        isPranzoClosed: false,
        isCenaClosed: false,
        isFullClosure: false,
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
        <div className="space-y-6 max-w-6xl mx-auto pb-20 px-2 sm:px-4">
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-3xl bg-gradient-to-br from-sky-200 to-blue-200" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
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
        {/* Benvenuto */}
        <section className="pd-card p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--pd-muted)' }}>
                {format(new Date(), 'EEEE d MMMM', { locale: it })}
              </p>
              <h1 className="pd-display text-2xl sm:text-3xl font-semibold tracking-tight mt-0.5">
                Ciao, {session?.user.username}
              </h1>
              <p className="mt-2 text-sm" style={{ color: 'var(--pd-muted)' }}>
                {isAdminUser ? 'Amministratore' : getRoleName(session?.user.primaryRole || 'USER')}
              </p>
            </div>

            <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-8" style={{ borderColor: 'var(--pd-border)' }}>
              {isAdminUser ? (
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--pd-muted)' }}>In sospeso</p>
                    <p className="pd-display text-2xl font-semibold tabular-nums" style={{ color: 'var(--pd-accent)' }}>{pendingHours?.totalShifts || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--pd-muted)' }}>Attivi</p>
                    <p className="pd-display text-2xl font-semibold tabular-nums" style={{ color: 'var(--pd-success)' }}>{stats.activeUsers || 0}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--pd-muted)' }}>Ore mese</p>
                    <p className="pd-display text-2xl font-semibold tabular-nums">{formatDecimalHoursIt(stats.myApprovedHours || 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--pd-muted)' }}>Turni</p>
                    <p className="pd-display text-2xl font-semibold tabular-nums" style={{ color: 'var(--pd-accent)' }}>{stats.myShiftsThisWeek || 0}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Weather Widget */}
        <WeatherWidget />

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-baseline justify-between gap-3 w-full">
              <h2 className="pd-display text-xl font-semibold">Chi lavora oggi</h2>
              <span className="text-xs font-medium" style={{ color: 'var(--pd-muted)' }}>
                {format(new Date(), 'dd/MM')} · {todayShifts?.totalWorkers ?? 0} in servizio
              </span>
            </div>
            {isAdminUser && (
              <a href="/admin/schedule" className="text-xs font-medium shrink-0 ml-4" style={{ color: 'var(--pd-accent)' }}>
                Piano completo →
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {todayShifts && (() => {
              const pranzoN = todayShifts.shifts['PRANZO']?.length ?? 0
              const cenaN = todayShifts.shifts['CENA']?.length ?? 0
              const hasWorkers = pranzoN > 0 || cenaN > 0
              const hasHoliday = (todayShifts.holidays?.length ?? 0) > 0
              const prClosed = !!todayShifts.isPranzoClosed
              const ceClosed = !!todayShifts.isCenaClosed
              const showSlot = (t: 'PRANZO' | 'CENA') =>
                (t === 'PRANZO' ? prClosed : ceClosed) || (todayShifts.shifts[t]?.length ?? 0) > 0
              const anySlot = showSlot('PRANZO') || showSlot('CENA')
              const showEmpty = !hasWorkers && !hasHoliday && !anySlot

              if (showEmpty) {
                return (
                  <div className="col-span-full pd-card border-dashed py-12 text-center" style={{ borderStyle: 'dashed' }}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--pd-surface-muted)' }}>
                    <Calendar className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--pd-muted)' }}>
                    Nessun turno programmato per oggi
                  </p>
                </div>
                )
              }

              const holidayDescriptions = [
                ...new Set(
                  (todayShifts.holidays ?? [])
                    .map((h) => h.description?.trim())
                    .filter(Boolean) as string[]
                ),
              ]

              return (
                <>
                  {hasHoliday && (
                    <div className="col-span-full pd-card p-5" style={{ background: 'var(--pd-warning-soft)' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--pd-surface)' }}>
                          <Sparkles className="h-5 w-5" style={{ color: 'var(--pd-warning)' }} />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-semibold" style={{ color: 'var(--pd-warning)' }}>
                            Festa o chiusura oggi
                          </p>
                          {todayShifts.isFullClosure && (
                            <p className="text-sm font-bold text-amber-950 mt-1">
                              Locale chiuso tutto il giorno
                            </p>
                          )}
                          {!todayShifts.isFullClosure && prClosed && !ceClosed && (
                            <p className="text-sm font-bold text-amber-950 mt-1">Chiusura solo a pranzo</p>
                          )}
                          {!todayShifts.isFullClosure && ceClosed && !prClosed && (
                            <p className="text-sm font-bold text-amber-950 mt-1">Chiusura solo a cena</p>
                          )}
                          {holidayDescriptions.length > 0 && (
                            <p className="text-xs font-semibold text-amber-900/90 mt-2 leading-snug">
                              {holidayDescriptions.join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {(['PRANZO', 'CENA'] as const).map((type) => {
                    const shifts = todayShifts.shifts[type] || []
                    const closed = type === 'PRANZO' ? prClosed : ceClosed
                    if (closed && shifts.length === 0) {
                      return (
                        <div key={type} className="pd-card overflow-hidden">
                          <div
                            className={cn(
                              'px-6 py-4 border-b flex items-center justify-between',
                              type === 'PRANZO' ? 'bg-red-50/40 border-red-100' : 'bg-red-50/30 border-red-100'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  'w-8 h-8 rounded-xl flex items-center justify-center shadow-sm',
                                  type === 'PRANZO'
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-red-100 text-red-700'
                                )}
                              >
                                {type === 'PRANZO' ? (
                                  <Pizza className="h-4 w-4" />
                                ) : (
                                  <UtensilsCrossed className="h-4 w-4" />
                                )}
                              </div>
                              <span className="text-xs font-black uppercase tracking-[0.2em] text-red-800">
                                Turno {type}
                              </span>
                            </div>
                            <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                              Chiuso
                            </span>
                          </div>
                          <div className="p-8 flex flex-col items-center justify-center text-center">
                            <Sparkles className="h-8 w-8 text-red-300 mb-2" />
                            <p className="text-sm font-black text-red-700 uppercase tracking-wide">
                              Nessun servizio
                            </p>
                            <p className="text-[11px] text-red-600/80 mt-1 font-medium">
                              Giorno festivo o chiusura programmata
                            </p>
                          </div>
                        </div>
                      )
                    }
                    if (shifts.length === 0) return null

                    return (
                      <div key={type} className="pd-card overflow-hidden">
                        <div
                          className={cn(
                            'px-6 py-4 border-b border-gray-50 flex items-center justify-between',
                            type === 'PRANZO' ? 'bg-orange-50/30' : 'bg-[var(--pd-accent-soft)]'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-xl flex items-center justify-center shadow-sm',
                                type === 'PRANZO'
                                  ? 'bg-orange-100 text-orange-600'
                                  : 'bg-[var(--pd-accent-soft)] text-[var(--pd-accent)]'
                              )}
                            >
                              {type === 'PRANZO' ? (
                                <Pizza className="h-4 w-4" />
                              ) : (
                                <UtensilsCrossed className="h-4 w-4" />
                              )}
                            </div>
                            <span
                              className={cn(
                                'text-xs font-black uppercase tracking-[0.2em]',
                                type === 'PRANZO' ? 'text-orange-700' : 'text-[var(--pd-accent)]'
                              )}
                            >
                              Turno {type}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {shifts.length} {shifts.length === 1 ? 'Persona' : 'Persone'}
                          </span>
                        </div>
                        <div className="p-4 grid grid-cols-1 gap-2">
                          {shifts.map((s) => {
                            const isCurrentUser = s.user.id === session?.user.id
                            return (
                              <div
                                key={s.id}
                                className={cn(
                                  'group flex items-center justify-between p-3 rounded-2xl transition-all duration-300',
                                  isCurrentUser
                                    ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 shadow-lg shadow-orange-100 ring-2 ring-orange-200 ring-offset-2'
                                    : 'bg-white border border-gray-100 hover:border-orange-200 hover:shadow-md'
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={cn(
                                      'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                                      isCurrentUser
                                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-200'
                                        : 'bg-gray-50 text-gray-400 group-hover:bg-orange-50 group-hover:text-orange-600'
                                    )}
                                  >
                                    {s.role === 'FATTORINO' ? (
                                      <Bike className="h-5 w-5" />
                                    ) : s.role === 'CUCINA' ? (
                                      <ChefHat className="h-5 w-5" />
                                    ) : (
                                      <UserCheck className="h-5 w-5" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p
                                        className={cn(
                                          'text-sm font-black truncate leading-none',
                                          isCurrentUser ? 'text-orange-700' : 'text-gray-900'
                                        )}
                                      >
                                        {s.user.username}
                                      </p>
                                      {isCurrentUser && (
                                        <span className="px-2 py-0.5 bg-orange-500 text-white text-[8px] font-black uppercase tracking-wider rounded-full animate-pulse">
                                          Tu
                                        </span>
                                      )}
                                    </div>
                                    <p
                                      className={cn(
                                        'text-[9px] font-bold uppercase tracking-widest mt-1',
                                        isCurrentUser ? 'text-orange-500' : 'text-gray-400'
                                      )}
                                    >
                                      {getRoleName(s.role as Role)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span
                                    className={cn(
                                      'text-[10px] font-black px-2 py-1 rounded-lg border',
                                      isCurrentUser
                                        ? 'text-orange-700 bg-orange-100 border-orange-200'
                                        : 'text-gray-900 bg-gray-50 border-gray-100'
                                    )}
                                  >
                                    {s.startTime}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </>
              )
            })()}
          </div>
        </div>

        {/* Alerts & Critical Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notifications / Alerts - Col span 2 */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="pd-section-title px-2">
              Azioni richieste
            </h2>
            
            <div className="grid grid-cols-1 gap-4">
              {/* Admin: Approvals */}
              {isAdminUser && pendingHours && pendingHours.totalShifts > 0 && (
                <div className="relative overflow-hidden pd-card p-6" style={{ background: 'var(--pd-accent)', color: 'var(--pd-accent-fg)' }}>
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Clock className="h-20 w-20 text-white" />
                  </div>
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                      <h3 className="text-white text-xl font-black tracking-tight">Revisione ore</h3>
                      <p className="text-orange-100 text-sm font-medium mt-1">
                        {pendingHours.totalShifts === 1
                          ? "C'è una registrazione ore in attesa di approvazione o rifiuto."
                          : `Ci sono ${pendingHours.totalShifts} registrazioni ore in attesa di approvazione o rifiuto.`}
                      </p>
                    </div>
                    <a href="/admin/hours" onClick={() => lightClick()} className="px-6 py-3 rounded-2xl text-sm font-semibold text-center pd-press" style={{ background: 'var(--pd-surface)', color: 'var(--pd-accent)' }}>
                      Approva ora
                    </a>
                  </div>
                </div>
              )}

              {/* User: Missing Hours */}
              {!isAdminUser && missingHours && missingHours.count > 0 && (
                <div className="relative overflow-hidden pd-card p-6" style={{ background: 'var(--pd-danger)', color: 'var(--pd-accent-fg)' }}>
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <AlertCircle className="h-20 w-20 text-white" />
                  </div>
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                      <h3 className="text-white text-xl font-black tracking-tight">Ore non ancora registrate</h3>
                      <p className="text-red-100 text-sm font-medium mt-1">
                        Hai {missingHours.count} {missingHours.count === 1 ? 'turno passato' : 'turni passati'} senza ore nel sistema. L&apos;amministrazione le inserirà: non devi fare nulla qui.
                      </p>
                    </div>
                    <a href="/hours" onClick={() => lightClick()} className="px-6 py-3 rounded-2xl text-sm font-semibold text-center pd-press" style={{ background: 'var(--pd-surface)', color: 'var(--pd-danger)' }}>
                      Vedi dettaglio
                    </a>
                  </div>
                </div>
              )}

              {/* Admin Task: Substitutions */}
              {isAdminUser && typeof stats.pendingSubstitutions === 'number' && stats.pendingSubstitutions > 0 && (
                <div className="pd-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[var(--pd-accent-soft)] rounded-2xl flex items-center justify-center text-[var(--pd-accent)]">
                      <UserPlus className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-gray-900 font-black tracking-tight uppercase text-sm">Sostituzioni</h3>
                      <p className="text-gray-400 text-xs font-medium mt-0.5">{stats.pendingSubstitutions} richieste da approvare</p>
                    </div>
                  </div>
                  <a href="/admin/substitutions" className="px-6 py-3 bg-[var(--pd-accent)] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[var(--pd-shadow)] active:scale-95 transition-all text-center">
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
            <h2 className="pd-section-title px-2">
              {isAdminUser ? 'Info settimanali' : 'I miei prossimi turni'}
            </h2>
            
            <div className="pd-card p-6 flex-1 min-h-[300px]">
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
      <NotificationPermissionPrompt />
    </MainLayout>
  )
}

function QuickActionItem({ href, title, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    purple: 'bg-[var(--pd-accent-soft)] text-[var(--pd-accent)] border-[var(--pd-border)]',
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
      <span className="text-[11px] font-medium text-center" style={{ color: 'var(--pd-muted)' }}>{title}</span>
    </a>
  )
}

function DashboardStatItem({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-[var(--pd-accent-soft)] text-[var(--pd-accent)]'
  }
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-xs font-medium" style={{ color: 'var(--pd-muted)' }}>{label}</span>
      </div>
      <span className="text-xl font-black text-gray-900">{value}</span>
    </div>
  )
}
