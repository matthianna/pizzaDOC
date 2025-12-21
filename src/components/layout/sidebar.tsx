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
  BanknotesIcon
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
  BanknotesIcon as BanknotesIconSolid
} from '@heroicons/react/24/solid'
import { cn, getRoleName } from '@/lib/utils'
import { isAdmin } from '@/lib/auth-utils'

export function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!session) return null

  const isUserAdmin = isAdmin(session)

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
      <div className="lg:hidden fixed top-0 left-0 z-50 p-4">
        <button
          type="button"
          className="rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 flex z-50">
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
            <div className="relative flex-1 flex flex-col max-w-xs w-full pt-5 pb-4 bg-white">
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  type="button"
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="sr-only">Close sidebar</span>
                  <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              </div>
              <SidebarContent 
                regularItems={regularItems}
                adminItems={adminItems}
                pathname={pathname}
                session={session}
                isUserAdmin={isUserAdmin}
                isMobile={true}
                onItemClick={() => setSidebarOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex flex-col flex-grow pt-5 bg-white overflow-y-auto border-r border-gray-200">
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
    <>
      {/* Logo */}
      <div className="flex items-center flex-shrink-0 px-4">
        <div className="flex items-center space-x-3 bg-gradient-to-r from-orange-500 to-orange-600 p-3 rounded-2xl shadow-lg w-full">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center ring-4 ring-orange-300 shadow-md relative overflow-hidden">
            <Image
              src="/logo.png"
              alt="PizzaDOC Logo"
              width={32}
              height={32}
              className="object-cover"
              unoptimized
            />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">PizzaDOC</h1>
        </div>
      </div>

      {/* User info */}
      <div className="mt-6 px-4">
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-orange-100 to-orange-50 rounded-2xl p-4 shadow-lg border border-orange-200">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-200 rounded-full blur-2xl opacity-30 -mr-10 -mt-10"></div>
          <div className="relative flex items-center">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg ring-4 ring-orange-100">
                <span className="text-white font-bold text-lg">
                  {session.user.username.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-4 flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">
                {session.user.username}
              </p>
              <p className="text-xs font-semibold text-orange-700 bg-orange-200 px-2 py-0.5 rounded-full inline-block mt-1">
                {getRoleName(session.user.primaryRole)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-6 flex-1 px-4 space-y-1">
        {/* Regular navigation items - grouped by section */}
        {!isUserAdmin && regularItems.length > 0 && (
          <>
            {/* Home - Dashboard */}
            {regularItems.filter(item => item.section === 'home').map((item) => {
              const Icon = pathname === item.href ? item.iconSolid : item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onItemClick}
                  className={cn(
                    'group flex items-center px-4 py-3 text-base font-semibold rounded-xl transition-all mb-4',
                    pathname === item.href
                      ? 'bg-gradient-to-r from-orange-100 to-orange-50 text-orange-700 shadow-md border-l-4 border-orange-500 scale-105'
                      : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-white hover:shadow-sm hover:scale-102'
                  )}
                >
                  <span className="text-2xl mr-3">{item.emoji}</span>
                  {item.name}
                </Link>
              )
            })}

            {/* Il Mio Lavoro */}
            <div className="mt-6">
              <h3 className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                <span className="mr-2">📋</span>
                Il Mio Lavoro
              </h3>
              <div className="space-y-1">
                {regularItems.filter(item => item.section === 'lavoro').map((item) => {
                  const Icon = pathname === item.href ? item.iconSolid : item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all',
                        pathname === item.href
                          ? 'bg-gradient-to-r from-orange-100 to-orange-50 text-orange-700 shadow-sm border-l-4 border-orange-500'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                      )}
                    >
                      <span className="text-lg mr-3">{item.emoji}</span>
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Ore & Assenze */}
            <div className="mt-6">
              <h3 className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                <span className="mr-2">⏰</span>
                Ore & Assenze
              </h3>
              <div className="space-y-1">
                {regularItems.filter(item => item.section === 'ore').map((item) => {
                  const Icon = pathname === item.href ? item.iconSolid : item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all',
                        pathname === item.href
                          ? 'bg-gradient-to-r from-orange-100 to-orange-50 text-orange-700 shadow-sm border-l-4 border-orange-500'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                      )}
                    >
                      <span className="text-lg mr-3">{item.emoji}</span>
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Sostituzioni */}
            <div className="mt-6">
              <h3 className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                <span className="mr-2">🔄</span>
                Sostituzioni
              </h3>
              <div className="space-y-1">
                {regularItems.filter(item => item.section === 'sostituzioni').map((item) => {
                  const Icon = pathname === item.href ? item.iconSolid : item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all',
                        pathname === item.href
                          ? 'bg-gradient-to-r from-orange-100 to-orange-50 text-orange-700 shadow-sm border-l-4 border-orange-500'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                      )}
                    >
                      <span className="text-lg mr-3">{item.emoji}</span>
                      {item.name}
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
            <Link
              href="/dashboard"
              onClick={onItemClick}
              className={cn(
                'group flex items-center px-4 py-3 text-base font-semibold rounded-xl transition-all mb-4',
                pathname === '/dashboard'
                  ? 'bg-gradient-to-r from-orange-100 to-orange-50 text-orange-700 shadow-md border-l-4 border-orange-500 scale-105'
                  : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-white hover:shadow-sm hover:scale-102'
              )}
            >
              <span className="text-2xl mr-3">🏠</span>
              Dashboard
            </Link>

            {/* Gestione Personale */}
            <div className="mt-8">
              <h3 className="px-3 text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center">
                <span className="mr-2">👥</span>
                Gestione Personale
              </h3>
              <div className="space-y-1">
                {adminItems.filter(item => item.section === 'personale').map((item) => {
                  const Icon = pathname === item.href ? item.iconSolid : item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                        pathname === item.href
                          ? 'bg-orange-100 text-orange-700 border-l-4 border-orange-500'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <Icon 
                        className={cn(
                          'mr-3 h-5 w-5 flex-shrink-0',
                          pathname === item.href ? 'text-orange-500' : 'text-gray-400 group-hover:text-gray-500'
                        )} 
                      />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Pianificazione */}
            <div className="mt-6">
              <h3 className="px-3 text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center">
                <span className="mr-2">📅</span>
                Pianificazione
              </h3>
              <div className="space-y-1">
                {adminItems.filter(item => item.section === 'pianificazione').map((item) => {
                  const Icon = pathname === item.href ? item.iconSolid : item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                        pathname === item.href
                          ? 'bg-orange-100 text-orange-700 border-l-4 border-orange-500'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <Icon 
                        className={cn(
                          'mr-3 h-5 w-5 flex-shrink-0',
                          pathname === item.href ? 'text-orange-500' : 'text-gray-400 group-hover:text-gray-500'
                        )} 
                      />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Ore Lavorate */}
            <div className="mt-6">
              <h3 className="px-3 text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center">
                <span className="mr-2">⏰</span>
                Ore Lavorate
              </h3>
              <div className="space-y-1">
                {adminItems.filter(item => item.section === 'ore').map((item) => {
          const Icon = pathname === item.href ? item.iconSolid : item.icon
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onItemClick}
              className={cn(
                'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                pathname === item.href
                          ? 'bg-orange-100 text-orange-700 border-l-4 border-orange-500'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon 
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  pathname === item.href ? 'text-orange-500' : 'text-gray-400 group-hover:text-gray-500'
                )} 
              />
              {item.name}
            </Link>
          )
        })}
              </div>
            </div>

            {/* Sistema */}
            <div className="mt-6">
              <h3 className="px-3 text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center">
                <span className="mr-2">⚙️</span>
                Sistema
              </h3>
              <div className="space-y-1">
                {adminItems.filter(item => item.section === 'sistema').map((item) => {
                  const Icon = pathname === item.href ? item.iconSolid : item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                        pathname === item.href
                          ? 'bg-orange-100 text-orange-700 border-l-4 border-orange-500'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <Icon 
                        className={cn(
                          'mr-3 h-5 w-5 flex-shrink-0',
                          pathname === item.href ? 'text-orange-500' : 'text-gray-400 group-hover:text-gray-500'
                        )} 
                      />
                      {item.name}
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
    </>
  )
}
