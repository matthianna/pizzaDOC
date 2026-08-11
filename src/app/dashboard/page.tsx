'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MainLayout } from '@/components/layout/main-layout'
import { useSession } from 'next-auth/react'
import {
  Calendar,
  Clock,
  CalendarDays,
  ArrowLeftRight,
  AlertCircle,
  Bike,
  ChefHat,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { getRoleName } from '@/lib/utils'
import type { Role } from '@prisma/client'
import { useHaptics } from '@/hooks/use-haptics'
import { Skeleton } from '@/components/ui/skeleton'
import { WeatherWidget } from '@/components/weather/weather-widget'
import { NotificationPermissionPrompt } from '@/components/notifications/notification-permission-prompt'
import { formatDecimalHoursIt } from '@/lib/format-hours-display'
import { getShiftTimes } from '@/lib/date-utils'
import { StatStrip } from '@/components/ui/stat-strip'
import { SectionBlock } from '@/components/ui/section-block'
import { QuickActionPills } from '@/components/ui/quick-action-pills'
import { ListRow, EmptyState } from '@/components/ui/list-row'

interface DashboardStats {
  totalUsers?: number
  activeUsers?: number
  pendingHours?: number
  thisWeekSchedules?: number
  pendingSubstitutions?: number
  totalShiftsThisWeek?: number
  totalAbsencesActive?: number
  availabilitiesThisWeek?: number
  approvedSubstitutions?: number
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

function roleIcon(role: string) {
  if (role === 'FATTORINO') return Bike
  if (role === 'CUCINA') return ChefHat
  return UserCheck
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats>({})
  const [todayShifts, setTodayShifts] = useState<TodayShiftsData | null>(null)
  const [myShifts, setMyShifts] = useState<MyShiftsData | null>(null)
  const [pendingHours, setPendingHours] = useState<PendingHoursData | null>(null)
  const [missingHours, setMissingHours] = useState<MissingHoursData | null>(null)
  const [loading, setLoading] = useState(true)
  const [weatherOpen, setWeatherOpen] = useState(false)
  const { lightClick } = useHaptics()

  const isAdminUser = session?.user.roles.includes('ADMIN')
  const trackHours = !!session?.user.trackHours

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
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
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
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
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

  const hour = new Date().getHours()
  const greeting = hour < 17 ? 'Buongiorno' : 'Buonasera'
  const firstName = session?.user.username ?? ''

  const myTodayShifts: TodayShift[] = []
  if (todayShifts && session?.user.id) {
    for (const type of ['PRANZO', 'CENA'] as const) {
      for (const s of todayShifts.shifts[type] || []) {
        if (s.user.id === session.user.id) myTodayShifts.push(s)
      }
    }
  }

  let shiftSummary = 'Nessun turno oggi'
  if (myTodayShifts.length === 1) {
    const s = myTodayShifts[0]
    shiftSummary = `Oggi hai turno a ${s.shiftType === 'PRANZO' ? 'pranzo' : 'cena'} · ${s.startTime}–${s.endTime} · ${getRoleName(s.role as Role)}`
  } else if (myTodayShifts.length > 1) {
    shiftSummary = `Oggi hai ${myTodayShifts.length} turni · ${myTodayShifts
      .map((s) => `${s.shiftType === 'PRANZO' ? 'Pranzo' : 'Cena'} ${s.startTime}`)
      .join(' · ')}`
  } else if (isAdminUser) {
    shiftSummary = `${format(new Date(), 'EEEE d MMMM', { locale: it })} · Amministratore`
  }

  const statItems = isAdminUser
    ? [
        { label: 'Utenti attivi', value: stats.activeUsers ?? 0 },
        { label: 'Turni settimana', value: stats.totalShiftsThisWeek ?? 0 },
        {
          label: 'In attesa',
          value: pendingHours?.totalShifts ?? stats.pendingHours ?? 0,
          href: '/admin/hours',
        },
      ]
    : [
        { label: 'Turni settimana', value: stats.myShiftsThisWeek ?? 0 },
        ...(trackHours
          ? [
              { label: 'Ore mese', value: formatDecimalHoursIt(stats.myApprovedHours || 0) },
              { label: 'Sostituzioni', value: stats.myPendingSubstitutions ?? 0 },
            ]
          : [{ label: 'Sostituzioni', value: stats.myPendingSubstitutions ?? 0 }]),
      ]

  const quickActions = [
    ...(!isAdminUser
      ? [{ label: 'Disponibilità', href: '/availability', icon: CalendarDays }]
      : [{ label: 'Piano turni', href: '/admin/schedule', icon: CalendarDays }]),
    ...(isAdminUser || trackHours
      ? [
          {
            label: isAdminUser ? 'Ore' : 'Le mie ore',
            href: isAdminUser ? '/admin/hours' : '/hours',
            icon: Clock,
          },
        ]
      : []),
    {
      label: 'Sostituzioni',
      href: isAdminUser ? '/admin/substitutions' : '/substitution-requests',
      icon: ArrowLeftRight,
    },
  ]

  const showAdminHoursAlert = isAdminUser && pendingHours && pendingHours.totalShifts > 0
  const showMissingHoursAlert = !isAdminUser && missingHours && missingHours.count > 0
  const showSubsAlert =
    isAdminUser && typeof stats.pendingSubstitutions === 'number' && stats.pendingSubstitutions > 0
  const hasActions = showAdminHoursAlert || showMissingHoursAlert || showSubsAlert

  if (loading) {
    return (
      <MainLayout contentWidth="4xl" title="Home">
        <div className="pd-page pb-4">
          <Skeleton className="h-20 w-full rounded-[var(--pd-radius-lg)]" />
          <Skeleton className="h-20 w-full rounded-[var(--pd-radius-lg)]" />
          <Skeleton className="h-10 w-64 rounded-full" />
          <Skeleton className="h-48 w-full rounded-[var(--pd-radius-lg)]" />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout contentWidth="4xl" title="Home">
      <div className="pd-page pb-4">
        <section>
          <p className="text-sm font-medium" style={{ color: 'var(--pd-muted)' }}>
            {greeting}
          </p>
          <h2 className="pd-display text-2xl sm:text-3xl font-semibold tracking-tight mt-0.5">
            {firstName}
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--pd-muted)' }}>
            {shiftSummary}
          </p>
        </section>

        <StatStrip items={statItems} />

        <SectionBlock title="Azioni rapide">
          <QuickActionPills items={quickActions} />
        </SectionBlock>

        <SectionBlock
          title="Turni di oggi"
          subtitle={`${todayShifts?.totalWorkers ?? 0} in servizio · ${format(new Date(), 'dd/MM')}`}
          action={
            isAdminUser ? (
              <a
                href="/admin/schedule"
                className="text-xs font-semibold"
                style={{ color: 'var(--pd-accent)' }}
              >
                Piano completo →
              </a>
            ) : (
              <a href="/schedule" className="text-xs font-semibold" style={{ color: 'var(--pd-accent)' }}>
                Mio piano →
              </a>
            )
          }
        >
          {todayShifts &&
            (() => {
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
                  <div
                    className="overflow-hidden"
                    style={{
                      background: 'var(--pd-surface)',
                      border: '1px solid var(--pd-border)',
                      borderRadius: 'var(--pd-radius-lg)',
                    }}
                  >
                    <EmptyState
                      title="Nessun turno programmato"
                      description="Per oggi non ci sono turni in calendario."
                      icon={<Calendar className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
                    />
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
                <div className="space-y-5">
                  {hasHoliday && (
                    <div
                      className="px-4 py-3 flex items-start gap-3"
                      style={{
                        background: 'var(--pd-warning-soft)',
                        border: '1px solid color-mix(in srgb, var(--pd-warning) 25%, transparent)',
                        borderRadius: 'var(--pd-radius-lg)',
                      }}
                    >
                      <Sparkles
                        className="h-4 w-4 shrink-0 mt-0.5"
                        style={{ color: 'var(--pd-warning)' }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--pd-warning)' }}>
                          {todayShifts.isFullClosure
                            ? 'Locale chiuso tutto il giorno'
                            : prClosed && !ceClosed
                              ? 'Chiusura solo a pranzo'
                              : ceClosed && !prClosed
                                ? 'Chiusura solo a cena'
                                : 'Festa o chiusura oggi'}
                        </p>
                        {holidayDescriptions.length > 0 && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                            {holidayDescriptions.join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {(['PRANZO', 'CENA'] as const).map((type) => {
                    const shifts = todayShifts.shifts[type] || []
                    const closed = type === 'PRANZO' ? prClosed : ceClosed
                    if (!closed && shifts.length === 0) return null

                    const times = getShiftTimes(type)
                    const title = type === 'PRANZO' ? 'Pranzo' : 'Cena'

                    return (
                      <div key={type}>
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                            {title}
                          </p>
                          <span className="text-xs" style={{ color: 'var(--pd-muted)' }}>
                            {closed ? 'Chiuso' : `${times.start}–${times.end}`}
                          </span>
                        </div>
                        <ul
                          className="overflow-hidden"
                          style={{
                            background: 'var(--pd-surface)',
                            border: '1px solid var(--pd-border)',
                            borderRadius: 'var(--pd-radius-lg)',
                          }}
                        >
                          {closed && shifts.length === 0 ? (
                            <li className="px-4 py-4 text-sm" style={{ color: 'var(--pd-muted)' }}>
                              Nessun servizio · chiusura programmata
                            </li>
                          ) : (
                            shifts.map((s) => {
                              const isMe = s.user.id === session?.user.id
                              const Icon = roleIcon(s.role)
                              return (
                                <ListRow
                                  key={s.id}
                                  as="li"
                                  highlight={isMe}
                                  className="last:border-b-0"
                                  leading={
                                    <span
                                      className="flex h-9 w-9 items-center justify-center rounded-full shrink-0"
                                      style={{
                                        background: isMe
                                          ? 'var(--pd-accent)'
                                          : 'var(--pd-surface-muted)',
                                        color: isMe ? 'var(--pd-accent-fg)' : 'var(--pd-muted)',
                                      }}
                                    >
                                      <Icon className="h-4 w-4" />
                                    </span>
                                  }
                                  title={
                                    <>
                                      {s.user.username}
                                      {isMe && (
                                        <span
                                          className="ml-2 text-[10px] font-bold uppercase tracking-wider"
                                          style={{ color: 'var(--pd-accent)' }}
                                        >
                                          Tu
                                        </span>
                                      )}
                                    </>
                                  }
                                  subtitle={`${getRoleName(s.role as Role)} · ${s.startTime}–${s.endTime}`}
                                />
                              )
                            })
                          )}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
        </SectionBlock>

        {hasActions && (
          <SectionBlock title="Azioni richieste" card>
              {showAdminHoursAlert && (
                <Link href="/admin/hours" onClick={() => lightClick()} className="block">
                  <ListRow
                    leading={<Clock className="h-5 w-5" style={{ color: 'var(--pd-accent)' }} />}
                    title="Revisione ore"
                    subtitle={
                      pendingHours!.totalShifts === 1
                        ? '1 registrazione in attesa'
                        : `${pendingHours!.totalShifts} registrazioni in attesa`
                    }
                    trailing={
                      <span className="text-xs font-semibold" style={{ color: 'var(--pd-accent)' }}>
                        Approva →
                      </span>
                    }
                  />
                </Link>
              )}

              {showMissingHoursAlert && (
                <Link href="/hours" onClick={() => lightClick()} className="block">
                  <ListRow
                    leading={<AlertCircle className="h-5 w-5" style={{ color: 'var(--pd-danger)' }} />}
                    title="Ore non registrate"
                    subtitle={
                      missingHours!.count === 1
                        ? '1 turno passato senza ore'
                        : `${missingHours!.count} turni passati senza ore`
                    }
                    trailing={
                      <span className="text-xs font-semibold" style={{ color: 'var(--pd-accent)' }}>
                        Dettaglio →
                      </span>
                    }
                  />
                </Link>
              )}

              {showSubsAlert && (
                <Link href="/admin/substitutions" onClick={() => lightClick()} className="block">
                  <ListRow
                    leading={<ArrowLeftRight className="h-5 w-5" style={{ color: 'var(--pd-accent)' }} />}
                    title="Sostituzioni"
                    subtitle={`${stats.pendingSubstitutions} ${
                      stats.pendingSubstitutions === 1 ? 'richiesta' : 'richieste'
                    } da approvare`}
                    trailing={
                      <span className="text-xs font-semibold" style={{ color: 'var(--pd-accent)' }}>
                        Gestisci →
                      </span>
                    }
                  />
                </Link>
              )}
          </SectionBlock>
        )}

        {!isAdminUser && myShifts && myShifts.shifts.length > 0 && (
          <SectionBlock title="I miei prossimi turni" card>
            {myShifts.shifts.slice(0, 5).map((s) => (
              <ListRow
                key={s.id}
                highlight={s.isToday}
                title={`${s.shiftType === 'PRANZO' ? 'Pranzo' : 'Cena'} · ${getRoleName(s.role as Role)}`}
                subtitle={`${s.dayName} ${format(new Date(s.date), 'd MMM', { locale: it })}`}
                meta={s.startTime}
              />
            ))}
          </SectionBlock>
        )}

        <section>
          <button
            type="button"
            onClick={() => setWeatherOpen((o) => !o)}
            className="w-full flex items-center justify-between px-1 py-2 text-left"
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--pd-muted)' }}>
              Meteo Locarno
            </span>
            {weatherOpen ? (
              <ChevronUp className="h-4 w-4" style={{ color: 'var(--pd-muted)' }} />
            ) : (
              <ChevronDown className="h-4 w-4" style={{ color: 'var(--pd-muted)' }} />
            )}
          </button>
          {weatherOpen && <WeatherWidget />}
        </section>
      </div>
      <NotificationPermissionPrompt />
    </MainLayout>
  )
}
