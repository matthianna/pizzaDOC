'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
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
  ShieldCheckIcon
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
  ShieldCheckIcon as ShieldCheckIconSolid
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
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: HomeIcon,
      iconSolid: HomeIconSolid,
      adminOnly: false
    },
    {
      name: 'Disponibilità',
      href: '/availability',
      icon: CalendarIcon,
      iconSolid: CalendarIconSolid,
      adminOnly: false,
      hideForAdmin: true // Admin non deve vedere questa sezione
    },
    {
      name: 'Ore Lavorate',
      href: '/hours',
      icon: ClockIcon,
      iconSolid: ClockIconSolid,
      adminOnly: false,
      hideForAdmin: true // Admin non deve vedere questa sezione
    },
    {
      name: 'Mio Piano',
      href: '/schedule',
      icon: ChartBarIcon,
      iconSolid: ChartBarIconSolid,
      adminOnly: false,
      hideForAdmin: true // Admin ha già la sua vista piano
    },
    {
      name: 'Sostituzioni',
      href: '/substitution-requests',
      icon: UserPlusIcon,
      iconSolid: UserPlusIconSolid,
      adminOnly: false,
      hideForAdmin: true // Admin ha la sua vista admin
    },
    {
      name: 'Assenze',
      href: '/absences',
      icon: CalendarIcon,
      iconSolid: CalendarIconSolid,
      adminOnly: false,
      hideForAdmin: true
    },
    // Sezione Admin - Gestione Personale
    {
      name: 'Gestione Utenti',
      href: '/admin/users',
      icon: UsersIcon,
      iconSolid: UsersIconSolid,
      adminOnly: true
    },
    {
      name: 'Disponibilità Utenti',
      href: '/admin/availability-overview',
      icon: UsersIcon,
      iconSolid: UsersIconSolid,
      adminOnly: true
    },
    // Sezione Admin - Pianificazione
    {
      name: 'Piano Lavoro',
      href: '/admin/schedule',
      icon: ChartBarIcon,
      iconSolid: ChartBarIconSolid,
      adminOnly: true
    },
    {
      name: 'Assenze',
      href: '/admin/absences',
      icon: CalendarIcon,
      iconSolid: CalendarIconSolid,
      adminOnly: true
    },
    {
      name: 'Sostituzioni',
      href: '/admin/substitutions',
      icon: UserPlusIcon,
      iconSolid: UserPlusIconSolid,
      adminOnly: true
    },
    // Sezione Admin - Ore Lavorate
    {
      name: 'Gestione Ore',
      href: '/admin/hours',
      icon: ClockIcon,
      iconSolid: ClockIconSolid,
      adminOnly: true
    },
    {
      name: 'Riepilogo Ore',
      href: '/admin/hours-summary',
      icon: PresentationChartLineIcon,
      iconSolid: PresentationChartLineIconSolid,
      adminOnly: true
    },
    // Sezione Admin - Sistema
    {
      name: 'Configurazioni',
      href: '/admin/settings',
      icon: Cog6ToothIcon,
      iconSolid: Cog6ToothIconSolid,
      adminOnly: true
    },
    {
      name: 'Sistema e Sicurezza',
      href: '/admin/system',
      icon: ShieldCheckIcon,
      iconSolid: ShieldCheckIconSolid,
      adminOnly: true
    },
    {
      name: 'Analytics (DEV)',
      href: '/admin/analytics',
      icon: ChartBarIcon,
      iconSolid: ChartBarIconSolid,
      adminOnly: true
    }
  ]

  // Filtra la navigazione in base ai permessi
  const visibleNavigation = navigation.filter(item => {
    if (item.adminOnly && !isUserAdmin) return false
    if (item.hideForAdmin && isUserAdmin) return false
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
                isAdmin={isAdmin}
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
            isAdmin={isAdmin}
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
  isAdmin, 
  isMobile, 
  onItemClick 
}: {
  regularItems: any[]
  adminItems: any[]
  pathname: string
  session: any
  isAdmin: boolean
  isMobile: boolean
  onItemClick?: () => void
}) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center flex-shrink-0 px-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
            <img
              src="/logo.png"
              alt="PizzaDOC Logo"
              className="w-10 h-10 rounded-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const nextEl = e.currentTarget.nextElementSibling as HTMLElement
                if (nextEl) nextEl.style.display = 'block'
              }}
            />
            <span className="text-white font-bold text-lg hidden">🍕</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">PizzaDOC</h1>
        </div>
      </div>

      {/* User info */}
      <div className="mt-6 px-4">
        <div className="bg-orange-50 rounded-lg p-3">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-orange-600 font-semibold text-sm">
                  {session.user.username.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session.user.username}
              </p>
              <p className="text-xs text-orange-600">
                {getRoleName(session.user.primaryRole)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-6 flex-1 px-4 space-y-1">
        {/* Regular navigation items */}
        {regularItems.map((item) => {
          const Icon = pathname === item.href ? item.iconSolid : item.icon
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onItemClick}
              className={cn(
                'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                pathname === item.href
                  ? 'bg-orange-100 text-orange-700 border-r-2 border-orange-500'
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

        {/* Admin section */}
        {isAdmin && adminItems.length > 0 && (
          <>
            <div className="mt-8">
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Amministrazione
              </h3>
              <div className="mt-2 space-y-1">
                {adminItems.map((item) => {
                  const Icon = pathname === item.href ? item.iconSolid : item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                        pathname === item.href
                          ? 'bg-orange-100 text-orange-700 border-r-2 border-orange-500'
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

      {/* Logout button */}
      <div className="flex-shrink-0 p-4">
        <button
          onClick={async () => {
            console.log('Signing out...')
            await signOut({ 
              callbackUrl: '/auth/signin',
              redirect: true 
            })
          }}
          className="group flex items-center w-full px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
          Esci
        </button>
      </div>
    </>
  )
}
