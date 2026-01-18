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
  UserGroupIcon,
  UsersIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChartBarIcon,
  UserPlusIcon,
  PresentationChartLineIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  BanknotesIcon,
  BellIcon
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  CalendarIcon as CalendarIconSolid,
  ClockIcon as ClockIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  UsersIcon as UsersIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  UserPlusIcon as UserPlusIconSolid,
  PresentationChartLineIcon as PresentationChartLineIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  BellIcon as BellIconSolid
} from '@heroicons/react/24/solid'
import { cn, getRoleName } from '@/lib/utils'
import { isAdmin } from '@/lib/auth-utils'
import { NotificationBell } from '../notifications/notification-bell'
import { useHaptics } from '@/hooks/use-haptics'

export function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { lightClick } = useHaptics()

  if (!session) return null

  const isUserAdmin = isAdmin(session)

  const handleOpenSidebar = () => {
    lightClick()
    setSidebarOpen(true)
  }

  const handleCloseSidebar = () => {
    lightClick()
    setSidebarOpen(false)
  }

  const navigation = [
    // 🏠 HOME
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: HomeIcon,
      iconSolid: HomeIconSolid,
      adminOnly: false,
      emoji: '🏠',
      section: 'home'
    },
    {
      name: 'Notifiche',
      href: '/notifications',
      icon: BellIcon,
      iconSolid: BellIconSolid,
      adminOnly: false,
      emoji: '🔔',
      section: 'home'
    },
    // 📅 IL MIO LAVORO
    {
      name: 'Disponibilità',
      href: '/availability',
      icon: CalendarIcon,
      iconSolid: CalendarIconSolid,
      adminOnly: false,
      hideForAdmin: true,
      emoji: '📅',
      section: 'lavoro'
    },
    {
      name: 'Mio Piano',
      href: '/schedule',
      icon: ChartBarIcon,
      iconSolid: ChartBarIconSolid,
      adminOnly: false,
      hideForAdmin: true,
      emoji: '📊',
      section: 'lavoro'
    },
    {
      name: 'Piano Settimanale',
      href: '/weekly-plan',
      icon: CalendarIcon,
      iconSolid: CalendarIconSolid,
      adminOnly: false,
      emoji: '📅',
      section: 'lavoro'
    },
    {
      name: 'Disponibilità Utenti',
      href: '/availability-overview',
      icon: UsersIcon,
      iconSolid: UsersIconSolid,
      adminOnly: false,
      hideForAdmin: true,
      emoji: '👥',
      section: 'lavoro'
    },
    // ⏰ ORE & ASSENZE
    {
      name: 'Ore Lavorate',
      href: '/hours',
      icon: ClockIcon,
      iconSolid: ClockIconSolid,
      adminOnly: false,
      hideForAdmin: true,
      emoji: '⏰',
      section: 'ore'
    },
    {
      name: 'Assenze',
      href: '/absences',
      icon: CalendarIcon,
      iconSolid: CalendarIconSolid,
      adminOnly: false,
      hideForAdmin: true,
      emoji: '🏖️',
      section: 'ore'
    },
    // 🔄 SOSTITUZIONI
    {
      name: 'Sostituzioni',
      href: '/substitution-requests',
      icon: UserPlusIcon,
      iconSolid: UserPlusIconSolid,
      adminOnly: false,
      hideForAdmin: true,
      emoji: '🔄',
      section: 'sostituzioni'
    },
    // 👥 GESTIONE PERSONALE
    {
      name: 'Gestione Utenti',
      href: '/admin/users',
      icon: UsersIcon,
      iconSolid: UsersIconSolid,
      adminOnly: true,
      section: 'personale'
    },
    {
      name: 'Disponibilità Utenti',
      href: '/availability-overview',
      icon: UsersIcon,
      iconSolid: UsersIconSolid,
      adminOnly: true,
      section: 'personale'
    },
    // 📅 PIANIFICAZIONE
    {
      name: 'Piano Lavoro',
      href: '/admin/schedule',
      icon: ChartBarIcon,
      iconSolid: ChartBarIconSolid,
      adminOnly: true,
      section: 'pianificazione'
    },
    {
      name: 'Assenze',
      href: '/admin/absences',
      icon: CalendarIcon,
      iconSolid: CalendarIconSolid,
      adminOnly: true,
      section: 'pianificazione'
    },
    {
      name: 'Sostituzioni',
      href: '/admin/substitutions',
      icon: UserPlusIcon,
      iconSolid: UserPlusIconSolid,
      adminOnly: true,
      section: 'pianificazione'
    },
    {
      name: 'Giorni Festivi',
      href: '/admin/holidays',
      icon: CalendarIcon,
      iconSolid: CalendarIconSolid,
      adminOnly: true,
      section: 'pianificazione'
    },
    // ⏰ ORE LAVORATE
    {
      name: 'Gestione Ore',
      href: '/admin/hours',
      icon: ClockIcon,
      iconSolid: ClockIconSolid,
      adminOnly: true,
      section: 'ore'
    },
    {
      name: 'Riepilogo Ore',
      href: '/admin/hours-summary',
      icon: PresentationChartLineIcon,
      iconSolid: PresentationChartLineIconSolid,
      adminOnly: true,
      section: 'ore'
    },
    {
      name: 'Acconti',
      href: '/admin/advances',
      icon: BanknotesIcon,
      iconSolid: BanknotesIconSolid,
      adminOnly: true,
      section: 'ore'
    },
    // ⚙️ SISTEMA
    {
      name: 'Configurazioni',
      href: '/admin/settings',
      icon: Cog6ToothIcon,
      iconSolid: Cog6ToothIconSolid,
      adminOnly: true,
      section: 'sistema'
    },
    {
      name: 'Sistema e Sicurezza',
      href: '/admin/system',
      icon: ShieldCheckIcon,
      iconSolid: ShieldCheckIconSolid,
      adminOnly: true,
      section: 'sistema'
    },
    {
      name: 'Centro Notifiche',
      href: '/admin/notifications/all',
      icon: BellIcon,
      iconSolid: BellIconSolid,
      adminOnly: true,
      section: 'sistema'
    },
    {
      name: 'Invia Broadcast',
      href: '/admin/notifications',
      icon: BellIcon,
      iconSolid: BellIconSolid,
      adminOnly: true,
      section: 'sistema'
    }
  ]

  // Filtra la navigazione in base ai permessi
  const visibleNavigation = navigation.filter(item => {
    if (item.adminOnly && !isUserAdmin) return false
    if (item.hideForAdmin && isUserAdmin) return false
    // Nascondi "Ore Lavorate" se l'utente non ha trackHours abilitato
    if (item.name === 'Ore Lavorate' && !session.user.trackHours) return false
    return true
  })

  const regularItems = visibleNavigation.filter(item => !item.adminOnly)
  const adminItems = visibleNavigation.filter(item => item.adminOnly)

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 z-50 p-2 sm:p-4 pt-safe">
        <button
          type="button"
          className="rounded-2xl p-3 inline-flex items-center justify-center text-gray-500 hover:text-orange-600 hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500 bg-white/80 backdrop-blur-md shadow-lg border border-white transition-all active:scale-90"
          onClick={handleOpenSidebar}
        >
          <span className="sr-only">Open sidebar</span>
          <Bars3Icon className="h-7 w-7" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 flex z-50">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={handleCloseSidebar} />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white animate-in slide-in-from-left duration-500 shadow-2xl">
              <div className="absolute top-0 right-0 -mr-16 pt-safe mt-6">
                <button
                  type="button"
                  className="ml-1 flex items-center justify-center h-12 w-12 rounded-2xl bg-orange-600 text-white shadow-xl shadow-orange-200 border border-orange-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white active:scale-90 transition-all"
                  onClick={handleCloseSidebar}
                >
                  <span className="sr-only">Close sidebar</span>
                  <XMarkIcon className="h-7 w-7" aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1 flex flex-col h-0 pt-safe overflow-y-auto pb-safe">
                <SidebarContent
                  regularItems={regularItems}
                  adminItems={adminItems}
                  pathname={pathname}
                  session={session}
                  isUserAdmin={isUserAdmin}
                  isMobile={true}
                  onItemClick={handleCloseSidebar}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30">
        <div className="flex flex-col flex-grow bg-white overflow-y-auto border-r border-gray-200">
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

function SidebarContent({
  regularItems,
  adminItems,
  pathname,
  session,
  isUserAdmin,
  isMobile,
  onItemClick
}: {
  regularItems: any[]
  adminItems: any[]
  pathname: string
  session: any
  isUserAdmin: boolean
  isMobile: boolean
  onItemClick?: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex items-center flex-shrink-0 px-4", isMobile ? "pt-4" : "pt-6")}>
        <div className="flex items-center space-x-3 bg-gradient-to-r from-orange-600 to-red-600 p-4 rounded-[2rem] shadow-xl w-full border border-white/20">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center ring-4 ring-orange-500/30 shadow-inner relative overflow-hidden">
            <Image
              src="/logo.png"
              alt="PizzaDOC Logo"
              width={36}
              height={36}
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="flex-1 flex items-center justify-between">
            <h1 className="text-xl font-black text-white tracking-tighter uppercase">PizzaDOC</h1>
            <div className="text-white bg-white/10 p-2 rounded-xl backdrop-blur-sm border border-white/10">
              <NotificationBell iconClassName="text-white h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="mt-6 px-4">
        <div className="relative overflow-hidden bg-white rounded-[2rem] p-4 shadow-soft border border-gray-100 group hover:shadow-lg transition-all duration-500">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-50 rounded-full blur-3xl opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="relative flex items-center">
            <div className="flex-shrink-0">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-red-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 group-hover:rotate-0 transition-transform duration-300">
                <span className="text-white font-black text-xl">
                  {session.user.username.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-4 flex-1 min-w-0">
              <p className="text-sm font-black text-gray-900 truncate tracking-tight">
                {session.user.username}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg uppercase tracking-wider border border-orange-100">
                  {getRoleName(session.user.primaryRole)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-8 flex-1 px-4 space-y-8 pb-8">
        {/* Regular navigation items - grouped by section */}
        {!isUserAdmin && regularItems.length > 0 && (
          <>
            {/* Home - Dashboard */}
            <div className="space-y-1">
              {regularItems.filter(item => item.section === 'home').map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={onItemClick}
                    className={cn(
                      'group flex items-center px-4 py-3.5 text-sm font-black rounded-[1.25rem] transition-all relative overflow-hidden',
                      isActive
                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-100 ring-1 ring-orange-400'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    )}
                  >
                    <span className={cn("text-xl mr-3 transition-transform duration-300 group-hover:scale-110", isActive ? "" : "grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100")}>
                      {item.emoji}
                    </span>
                    <span className="uppercase tracking-widest text-[11px]">{item.name}</span>
                    {isActive && <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20" />}
                  </Link>
                )
              })}
            </div>

            {/* Il Mio Lavoro */}
            <div className="space-y-3">
              <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2" />
                Il Mio Lavoro
              </h3>
              <div className="space-y-1">
                {regularItems.filter(item => item.section === 'lavoro').map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center px-4 py-3 text-sm font-black rounded-[1.25rem] transition-all relative',
                        isActive
                          ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-100 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      )}
                    >
                      <span className={cn("text-lg mr-3 transition-transform duration-300 group-hover:rotate-12", isActive ? "" : "grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100")}>
                        {item.emoji}
                      </span>
                      <span className="uppercase tracking-widest text-[10px]">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Ore & Assenze */}
            <div className="space-y-3">
              <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2" />
                Ore & Assenze
              </h3>
              <div className="space-y-1">
                {regularItems.filter(item => item.section === 'ore').map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center px-4 py-3 text-sm font-black rounded-[1.25rem] transition-all relative',
                        isActive
                          ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-100 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      )}
                    >
                      <span className={cn("text-lg mr-3 transition-transform duration-300 group-hover:rotate-12", isActive ? "" : "grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100")}>
                        {item.emoji}
                      </span>
                      <span className="uppercase tracking-widest text-[10px]">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Sostituzioni */}
            <div className="space-y-3">
              <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2" />
                Sostituzioni
              </h3>
              <div className="space-y-1">
                {regularItems.filter(item => item.section === 'sostituzioni').map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center px-4 py-3 text-sm font-black rounded-[1.25rem] transition-all relative',
                        isActive
                          ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-100 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      )}
                    >
                      <span className={cn("text-lg mr-3 transition-transform duration-300 group-hover:rotate-12", isActive ? "" : "grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100")}>
                        {item.emoji}
                      </span>
                      <span className="uppercase tracking-widest text-[10px]">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Admin section */}
        {isUserAdmin && adminItems.length > 0 && (
          <>
            {/* Dashboard - Admin */}
            <div className="space-y-1">
              <Link
                href="/dashboard"
                onClick={onItemClick}
                className={cn(
                  'group flex items-center px-4 py-3.5 text-sm font-black rounded-[1.25rem] transition-all relative overflow-hidden',
                  pathname === '/dashboard'
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-100 ring-1 ring-orange-400'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <span className={cn("text-xl mr-3 transition-transform duration-300 group-hover:scale-110", pathname === '/dashboard' ? "" : "grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100")}>
                  🏠
                </span>
                <span className="uppercase tracking-widest text-[11px]">Dashboard</span>
                {pathname === '/dashboard' && <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20" />}
              </Link>
            </div>

            {/* Gestione Personale */}
            <div className="space-y-3">
              <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2" />
                Gestione Personale
              </h3>
              <div className="space-y-1">
                {adminItems.filter(item => item.section === 'personale').map((item) => {
                  const isActive = pathname === item.href
                  const Icon = isActive ? item.iconSolid : item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center px-4 py-3 text-sm font-black rounded-[1.25rem] transition-all relative',
                        isActive
                          ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-100 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      )}
                    >
                      <Icon className={cn('mr-3 h-5 w-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110', isActive ? 'text-orange-500' : 'text-gray-400 group-hover:text-gray-500')} />
                      <span className="uppercase tracking-widest text-[10px]">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Pianificazione */}
            <div className="space-y-3">
              <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2" />
                Pianificazione
              </h3>
              <div className="space-y-1">
                {adminItems.filter(item => item.section === 'pianificazione').map((item) => {
                  const isActive = pathname === item.href
                  const Icon = isActive ? item.iconSolid : item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center px-4 py-3 text-sm font-black rounded-[1.25rem] transition-all relative',
                        isActive
                          ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-100 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      )}
                    >
                      <Icon className={cn('mr-3 h-5 w-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110', isActive ? 'text-orange-500' : 'text-gray-400 group-hover:text-gray-500')} />
                      <span className="uppercase tracking-widest text-[10px]">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Ore Lavorate */}
            <div className="space-y-3">
              <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2" />
                Ore Lavorate
              </h3>
              <div className="space-y-1">
                {adminItems.filter(item => item.section === 'ore').map((item) => {
                  const isActive = pathname === item.href
                  const Icon = isActive ? item.iconSolid : item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center px-4 py-3 text-sm font-black rounded-[1.25rem] transition-all relative',
                        isActive
                          ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-100 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      )}
                    >
                      <Icon className={cn('mr-3 h-5 w-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110', isActive ? 'text-orange-500' : 'text-gray-400 group-hover:text-gray-500')} />
                      <span className="uppercase tracking-widest text-[10px]">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Sistema */}
            <div className="space-y-3">
              <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2" />
                Sistema
              </h3>
              <div className="space-y-1">
                {adminItems.filter(item => item.section === 'sistema').map((item) => {
                  const isActive = pathname === item.href
                  const Icon = isActive ? item.iconSolid : item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center px-4 py-3 text-sm font-black rounded-[1.25rem] transition-all relative',
                        isActive
                          ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-100 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      )}
                    >
                      <Icon className={cn('mr-3 h-5 w-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110', isActive ? 'text-orange-500' : 'text-gray-400 group-hover:text-gray-500')} />
                      <span className="uppercase tracking-widest text-[10px]">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Profile Link */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200">
        <Link
          href={`/profile/${session.user.id}`}
          onClick={onItemClick}
          className={cn(
            'group flex items-center w-full px-4 py-3 text-sm font-semibold rounded-xl transition-all mb-2',
            pathname === `/profile/${session.user.id}`
              ? 'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 shadow-md border-l-4 border-blue-500'
              : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-white hover:shadow-sm'
          )}
        >
          <span className="text-lg mr-3">👤</span>
          Il Mio Profilo
        </Link>

        {/* Logout button */}
        <button
          onClick={async () => {
            console.log('Signing out...')
            await signOut({
              callbackUrl: '/auth/signin',
              redirect: true
            })
          }}
          className="group flex items-center w-full px-4 py-3 text-sm font-semibold text-gray-700 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 hover:text-red-700 transition-all hover:shadow-md border-2 border-transparent hover:border-red-200"
        >
          <span className="text-lg mr-3">🚪</span>
          Esci
        </button>
      </div>
    </div>
  )
}
