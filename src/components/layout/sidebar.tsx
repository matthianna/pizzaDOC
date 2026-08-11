'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  UserPlusIcon,
  PresentationChartLineIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  BellIcon,
  ChevronDownIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  CalendarIcon as CalendarIconSolid,
  ClockIcon as ClockIconSolid,
  UsersIcon as UsersIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  UserPlusIcon as UserPlusIconSolid,
  PresentationChartLineIcon as PresentationChartLineIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  BellIcon as BellIconSolid,
  UserCircleIcon as UserCircleIconSolid,
} from '@heroicons/react/24/solid'
import { cn, getRoleName } from '@/lib/utils'
import { isAdmin } from '@/lib/auth-utils'
import { NotificationBell } from '../notifications/notification-bell'
import { useHaptics } from '@/hooks/use-haptics'
import { ThemeToggle } from '@/components/theme/theme-toggle'

type NavItem = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  iconSolid: React.ComponentType<{ className?: string }>
  adminOnly: boolean
  hideForAdmin?: boolean
  section: string
}

const SECTION_LABELS: Record<string, string> = {
  home: 'Home',
  lavoro: 'Il mio lavoro',
  ore: 'Ore e assenze',
  sostituzioni: 'Sostituzioni',
  personale: 'Personale',
  pianificazione: 'Pianificazione',
  'admin-ore': 'Ore lavorate',
  sistema: 'Sistema',
}

export function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { lightClick } = useHaptics()

  if (!session) return null

  const isUserAdmin = isAdmin(session)

  const navigation: NavItem[] = [
    { name: 'Home', href: '/dashboard', icon: HomeIcon, iconSolid: HomeIconSolid, adminOnly: false, section: 'home' },
    { name: 'Notifiche', href: '/notifications', icon: BellIcon, iconSolid: BellIconSolid, adminOnly: false, section: 'home' },
    { name: 'Disponibilità', href: '/availability', icon: CalendarIcon, iconSolid: CalendarIconSolid, adminOnly: false, hideForAdmin: true, section: 'lavoro' },
    { name: 'Mio Piano', href: '/schedule', icon: ChartBarIcon, iconSolid: ChartBarIconSolid, adminOnly: false, hideForAdmin: true, section: 'lavoro' },
    { name: 'Piano Settimanale', href: '/weekly-plan', icon: CalendarIcon, iconSolid: CalendarIconSolid, adminOnly: false, section: 'lavoro' },
    { name: 'Disponibilità Utenti', href: '/availability-overview', icon: UsersIcon, iconSolid: UsersIconSolid, adminOnly: false, hideForAdmin: true, section: 'lavoro' },
    { name: 'Le mie ore', href: '/hours', icon: ClockIcon, iconSolid: ClockIconSolid, adminOnly: false, hideForAdmin: true, section: 'ore' },
    { name: 'Assenze', href: '/absences', icon: CalendarIcon, iconSolid: CalendarIconSolid, adminOnly: false, hideForAdmin: true, section: 'ore' },
    { name: 'Sostituzioni', href: '/substitution-requests', icon: UserPlusIcon, iconSolid: UserPlusIconSolid, adminOnly: false, hideForAdmin: true, section: 'sostituzioni' },
    { name: 'Gestione Utenti', href: '/admin/users', icon: UsersIcon, iconSolid: UsersIconSolid, adminOnly: true, section: 'personale' },
    { name: 'Disponibilità Utenti', href: '/availability-overview', icon: UsersIcon, iconSolid: UsersIconSolid, adminOnly: true, section: 'personale' },
    { name: 'Piano Lavoro', href: '/admin/schedule', icon: ChartBarIcon, iconSolid: ChartBarIconSolid, adminOnly: true, section: 'pianificazione' },
    { name: 'Assenze', href: '/admin/absences', icon: CalendarIcon, iconSolid: CalendarIconSolid, adminOnly: true, section: 'pianificazione' },
    { name: 'Sostituzioni', href: '/admin/substitutions', icon: UserPlusIcon, iconSolid: UserPlusIconSolid, adminOnly: true, section: 'pianificazione' },
    { name: 'Gestione Ore', href: '/admin/hours', icon: ClockIcon, iconSolid: ClockIconSolid, adminOnly: true, section: 'admin-ore' },
    { name: 'Riepilogo Ore', href: '/admin/hours-summary', icon: PresentationChartLineIcon, iconSolid: PresentationChartLineIconSolid, adminOnly: true, section: 'admin-ore' },
    { name: 'Acconti', href: '/admin/advances', icon: BanknotesIcon, iconSolid: BanknotesIconSolid, adminOnly: true, section: 'admin-ore' },
    { name: 'Configurazioni', href: '/admin/settings', icon: Cog6ToothIcon, iconSolid: Cog6ToothIconSolid, adminOnly: true, section: 'sistema' },
    { name: 'Sistema e Sicurezza', href: '/admin/system', icon: ShieldCheckIcon, iconSolid: ShieldCheckIconSolid, adminOnly: true, section: 'sistema' },
    { name: 'Centro Notifiche', href: '/admin/notifications/all', icon: BellIcon, iconSolid: BellIconSolid, adminOnly: true, section: 'sistema' },
    { name: 'Invia Broadcast', href: '/admin/notifications', icon: BellIcon, iconSolid: BellIconSolid, adminOnly: true, section: 'sistema' },
  ]

  const visibleNavigation = navigation.filter((item) => {
    if (item.adminOnly && !isUserAdmin) return false
    if (item.hideForAdmin && isUserAdmin) return false
    if (item.name === 'Le mie ore' && !session.user.trackHours) return false
    return true
  })

  const regularItems = visibleNavigation.filter((item) => !item.adminOnly)
  const adminItems = visibleNavigation.filter((item) => item.adminOnly)

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 z-50 p-2 sm:p-4 pt-safe">
        <button
          type="button"
          className="rounded-xl p-3 inline-flex items-center justify-center transition-all active:scale-95"
          style={{
            color: 'var(--pd-muted)',
            background: 'var(--pd-surface)',
            border: '1px solid var(--pd-border)',
            boxShadow: 'var(--pd-shadow)',
          }}
          onClick={() => {
            lightClick()
            setSidebarOpen(true)
          }}
        >
          <span className="sr-only">Apri menu</span>
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      {sidebarOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 flex z-50">
            <div
              className="fixed inset-0 bg-black/40"
              onClick={() => {
                lightClick()
                setSidebarOpen(false)
              }}
            />
            <div
              className="relative flex-1 flex flex-col max-w-xs w-full shadow-2xl"
              style={{ background: 'var(--pd-surface)' }}
            >
              <div className="absolute top-0 right-0 -mr-14 pt-safe mt-5">
                <button
                  type="button"
                  className="flex items-center justify-center h-11 w-11 rounded-xl active:scale-95"
                  style={{ background: 'var(--pd-accent)', color: 'var(--pd-accent-fg)' }}
                  onClick={() => {
                    lightClick()
                    setSidebarOpen(false)
                  }}
                >
                  <span className="sr-only">Chiudi menu</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1 flex flex-col h-0 pt-safe pb-safe">
                <SidebarContent
                  regularItems={regularItems}
                  adminItems={adminItems}
                  pathname={pathname}
                  session={session}
                  isUserAdmin={isUserAdmin}
                  isMobile
                  onItemClick={() => setSidebarOpen(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30">
        <div
          className="flex flex-col flex-grow border-r"
          style={{ background: 'var(--pd-surface)', borderColor: 'var(--pd-border)' }}
        >
          <SidebarContent
            regularItems={regularItems}
            adminItems={adminItems}
            pathname={pathname}
            session={session}
            isUserAdmin={isUserAdmin}
            isMobile={false}
          />
        </div>
      </div>
    </>
  )
}

function NavLink({
  item,
  pathname,
  onItemClick,
}: {
  item: NavItem
  pathname: string
  onItemClick?: () => void
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const Icon = isActive ? item.iconSolid : item.icon
  return (
    <Link
      href={item.href}
      onClick={onItemClick}
      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors"
      style={{
        borderRadius: 'var(--pd-radius)',
        background: isActive ? 'var(--pd-accent-soft)' : 'transparent',
        color: isActive ? 'var(--pd-accent)' : 'var(--pd-text)',
      }}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{item.name}</span>
    </Link>
  )
}

function SidebarContent({
  regularItems,
  adminItems,
  pathname,
  session,
  isUserAdmin,
  isMobile,
  onItemClick,
}: {
  regularItems: NavItem[]
  adminItems: NavItem[]
  pathname: string
  session: { user: { id: string; username: string; primaryRole: string } }
  isUserAdmin: boolean
  isMobile: boolean
  onItemClick?: () => void
}) {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const renderSection = (sectionKey: string, items: NavItem[]) => {
    const sectionItems = items.filter((i) => i.section === sectionKey)
    if (sectionItems.length === 0) return null
    const isCollapsed = collapsedSections[sectionKey]
    return (
      <div key={sectionKey} className="space-y-1">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold tracking-wide"
          style={{ color: 'var(--pd-muted)' }}
        >
          <span>{SECTION_LABELS[sectionKey] ?? sectionKey}</span>
          <ChevronDownIcon
            className={cn('h-3.5 w-3.5 transition-transform', isCollapsed && '-rotate-90')}
          />
        </button>
        {!isCollapsed &&
          sectionItems.map((item) => (
            <NavLink key={`${item.section}-${item.name}-${item.href}`} item={item} pathname={pathname} onItemClick={onItemClick} />
          ))}
      </div>
    )
  }

  const staffSections = ['home', 'lavoro', 'ore', 'sostituzioni']
  const adminSections = ['personale', 'pianificazione', 'admin-ore', 'sistema']

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      <div
        className={cn('flex items-center gap-3 px-5 border-b', isMobile ? 'pt-5 pb-4' : 'py-6')}
        style={{ borderColor: 'var(--pd-border)' }}
      >
        <Image
          src="/logo-pizza-doc.png?v=3"
          alt="Pizza D.O.C."
          width={40}
          height={40}
          className="rounded-lg object-contain shrink-0"
          priority
        />
        <div className="min-w-0 flex-1">
          <p className="pd-display text-lg font-semibold leading-tight tracking-tight truncate">
            Pizza D.O.C.
          </p>
          <p className="text-[11px] truncate" style={{ color: 'var(--pd-muted)' }}>
            Gestione team
          </p>
        </div>
        {!isMobile ? <NotificationBell /> : null}
      </div>

      <div className="px-4 py-4">
        <div
          className="flex items-center gap-3 p-3"
          style={{
            background: 'var(--pd-surface-muted)',
            borderRadius: 'var(--pd-radius-lg)',
          }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold shrink-0"
            style={{ background: 'var(--pd-accent)', color: 'var(--pd-accent-fg)' }}
          >
            {session.user.username.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{session.user.username}</p>
            <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--pd-accent)' }}>
              {getRoleName(session.user.primaryRole)}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-4 pb-4 overflow-y-auto custom-scrollbar min-h-0">
        {!isUserAdmin && staffSections.map((s) => renderSection(s, regularItems))}
        {isUserAdmin && (
          <>
            {renderSection('home', regularItems)}
            {renderSection('lavoro', regularItems)}
            {adminSections.map((s) => renderSection(s, adminItems))}
          </>
        )}
      </nav>

      <div className="flex-shrink-0 p-4 space-y-2 border-t" style={{ borderColor: 'var(--pd-border)' }}>
        <ThemeToggle className="w-full justify-center" />
        <Link
          href={`/profile/${session.user.id}`}
          onClick={onItemClick}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium transition-colors"
          style={{
            borderRadius: 'var(--pd-radius)',
            background:
              pathname === `/profile/${session.user.id}` ? 'var(--pd-accent-soft)' : 'transparent',
            color:
              pathname === `/profile/${session.user.id}` ? 'var(--pd-accent)' : 'var(--pd-text)',
          }}
        >
          {pathname === `/profile/${session.user.id}` ? (
            <UserCircleIconSolid className="h-5 w-5" />
          ) : (
            <UserCircleIcon className="h-5 w-5" />
          )}
          Il mio profilo
        </Link>
        <button
          type="button"
          onClick={async () => {
            await signOut({ callbackUrl: '/auth/signin', redirect: true })
          }}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium transition-colors"
          style={{ borderRadius: 'var(--pd-radius)', color: 'var(--pd-danger)' }}
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          Esci
        </button>
      </div>
    </div>
  )
}
