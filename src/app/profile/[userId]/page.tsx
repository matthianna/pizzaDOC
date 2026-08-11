'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { StatStrip } from '@/components/ui/stat-strip'
import { SectionBlock } from '@/components/ui/section-block'
import { QuickActionPills } from '@/components/ui/quick-action-pills'
import { ListRow, EmptyState } from '@/components/ui/list-row'
import {
  User,
  Calendar,
  Clock,
  ShieldCheck,
  Bike,
  Car,
  Users,
  LayoutGrid,
  Settings,
  ArrowLeftRight,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { getRoleName, getShiftTypeName } from '@/lib/utils'
import { useParams } from 'next/navigation'
import { Role, ShiftType, TransportType } from '@prisma/client'
import { formatDecimalHoursIt } from '@/lib/format-hours-display'
import { Skeleton } from '@/components/ui/skeleton'
import { isAdmin } from '@/lib/auth-utils'

interface UserProfile {
  id: string
  username: string
  primaryRole: Role
  secondaryRoles: Role[]
  primaryTransport: TransportType | null
  isActive: boolean
  totalWorkedHours: number
  totalShifts: number
  upcomingShifts: {
    id: string
    dayOfWeek: number
    shiftType: ShiftType
    startTime: string
    endTime: string
    role: Role
    date: string
  }[]
  recentHours: {
    id: string
    submittedAt: string
    shifts: {
      dayOfWeek: number
      shiftType: ShiftType
      startTime: string
      endTime: string
      role: Role
    }
    totalHours: number
  }[]
}

export default function ProfilePage() {
  const params = useParams()
  const userId = params?.userId as string
  const { data: session } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) fetchProfile()
  }, [userId])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/user/profile/${userId}`)
      if (response.ok) {
        setProfile(await response.json())
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <MainLayout contentWidth="4xl">
        <div className="pd-page">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </MainLayout>
    )
  }

  if (!profile) {
    return (
      <MainLayout contentWidth="4xl">
        <div className="pd-page">
          <SectionBlock card>
            <EmptyState
              title="Profilo non trovato"
              description="L'utente che stai cercando non esiste o è stato rimosso."
              icon={<User className="h-8 w-8" style={{ color: 'var(--pd-muted)' }} />}
            />
          </SectionBlock>
        </div>
      </MainLayout>
    )
  }

  const profileIsAdmin = profile.primaryRole === 'ADMIN'
  const viewingOwnProfile = session?.user?.id === profile.id
  const viewerIsAdmin = isAdmin(session)
  // Admin accounts are managers — never show staff hours/shifts UI for them
  const showStaffWorkSections = !profileIsAdmin

  return (
    <MainLayout
      contentWidth="4xl"
      title={viewingOwnProfile ? 'Il mio profilo' : profile.username}
      subtitle={profileIsAdmin ? 'Amministratore' : getRoleName(profile.primaryRole)}
    >
      <div className="pd-page pb-20">
        <PageHeader
          title={viewingOwnProfile ? (profileIsAdmin ? 'Account amministratore' : 'Il mio profilo') : profile.username}
          subtitle={
            profileIsAdmin
              ? [
                  'Amministratore',
                  profile.isActive ? 'Attivo' : 'Non attivo',
                  viewingOwnProfile ? 'Gestione Pizza D.O.C.' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : [
                  getRoleName(profile.primaryRole),
                  ...profile.secondaryRoles.map((r) => getRoleName(r)),
                  profile.isActive ? 'Attivo' : 'Non attivo',
                ].join(' · ')
          }
          action={
            profileIsAdmin ? (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                style={{
                  background: 'var(--pd-accent-soft)',
                  color: 'var(--pd-accent)',
                  borderRadius: 'var(--pd-radius-pill)',
                }}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </span>
            ) : profile.primaryTransport ? (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                style={{
                  background: 'var(--pd-surface-muted)',
                  borderRadius: 'var(--pd-radius-pill)',
                  color: 'var(--pd-text)',
                  border: '1px solid var(--pd-border)',
                }}
              >
                {profile.primaryTransport === 'AUTO' ? (
                  <Car className="h-3.5 w-3.5" />
                ) : (
                  <Bike className="h-3.5 w-3.5" />
                )}
                {profile.primaryTransport}
              </span>
            ) : null
          }
        />

        {profileIsAdmin && viewingOwnProfile ? (
          <>
            <SectionBlock
              title="Strumenti di gestione"
              subtitle="Scorciatoie alle aree admin"
            >
              <QuickActionPills
                items={[
                  { label: 'Piano lavoro', href: '/admin/schedule', icon: LayoutGrid },
                  { label: 'Utenti', href: '/admin/users', icon: Users },
                  { label: 'Ore', href: '/admin/hours', icon: Clock },
                  { label: 'Sostituzioni', href: '/admin/substitutions', icon: ArrowLeftRight },
                  { label: 'Configurazioni', href: '/admin/settings', icon: Settings },
                ]}
              />
            </SectionBlock>

            <SectionBlock title="Account" card>
              <ListRow title="Ruolo" subtitle="Amministratore del sistema" trailing={<ShieldCheck className="h-4 w-4" style={{ color: 'var(--pd-accent)' }} />} />
              <ListRow
                title="Stato"
                subtitle={profile.isActive ? 'Account attivo' : 'Account disattivato'}
              />
              {viewerIsAdmin && (
                <Link href="/admin/users" className="block">
                  <ListRow
                    title="Gestione utenti"
                    subtitle="Crea, modifica e disattiva collaboratori"
                    meta="Apri"
                  />
                </Link>
              )}
            </SectionBlock>
          </>
        ) : null}

        {showStaffWorkSections ? (
          <>
            <StatStrip
              items={[
                { label: 'Ore totali', value: formatDecimalHoursIt(profile.totalWorkedHours) },
                { label: 'Turni', value: profile.totalShifts },
              ]}
            />

            <SectionBlock title="Prossimi turni" card>
              {profile.upcomingShifts.length === 0 ? (
                <EmptyState
                  title="Nessun turno in programma"
                  icon={<Calendar className="h-7 w-7" style={{ color: 'var(--pd-muted)' }} />}
                />
              ) : (
                profile.upcomingShifts.slice(0, 5).map((shift) => (
                  <ListRow
                    key={shift.id}
                    title={getShiftTypeName(shift.shiftType)}
                    subtitle={`${getRoleName(shift.role)} · ${shift.startTime}–${shift.endTime}`}
                    meta={format(parseISO(shift.date), 'dd MMM', { locale: it })}
                  />
                ))
              )}
            </SectionBlock>

            <SectionBlock title="Attività recente" card>
              {profile.recentHours.length === 0 ? (
                <EmptyState
                  title="Ancora nessuna ora registrata"
                  icon={<Clock className="h-7 w-7" style={{ color: 'var(--pd-muted)' }} />}
                />
              ) : (
                profile.recentHours.map((hour) => (
                  <ListRow
                    key={hour.id}
                    title={format(parseISO(hour.submittedAt), 'dd MMMM yyyy', { locale: it })}
                    subtitle={`${getShiftTypeName(hour.shifts.shiftType)} · ${getRoleName(hour.shifts.role)}`}
                    meta={formatDecimalHoursIt(hour.totalHours)}
                  />
                ))
              )}
            </SectionBlock>
          </>
        ) : null}

        {profileIsAdmin && !viewingOwnProfile ? (
          <SectionBlock title="Account" card>
            <ListRow title="Ruolo" subtitle="Amministratore" />
            <ListRow title="Stato" subtitle={profile.isActive ? 'Attivo' : 'Non attivo'} />
            <EmptyState
              title="Nessun dato operativo"
              description="Gli account admin non hanno ore o turni personali."
            />
          </SectionBlock>
        ) : null}
      </div>
    </MainLayout>
  )
}
