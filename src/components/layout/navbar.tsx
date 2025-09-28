'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Pizza, Users, Calendar, Settings, LogOut, BarChart3, Clock, UserCheck } from 'lucide-react'
import { cn, getRoleName } from '@/lib/utils'

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()

  if (!session) return null

  const isAdmin = session.user.roles.includes('ADMIN')

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: BarChart3,
      adminOnly: false
    },
    {
      name: 'Disponibilità',
      href: '/availability',
      icon: Calendar,
      adminOnly: false
    },
    {
      name: 'Ore Lavorate',
      href: '/hours',
      icon: Clock,
      adminOnly: false
    },
    {
      name: 'Sostituzioni',
      href: '/substitutions',
      icon: UserCheck,
      adminOnly: false
    },
    {
      name: 'Gestione Utenti',
      href: '/admin/users',
      icon: Users,
      adminOnly: true
    },
    {
      name: 'Piano Lavoro',
      href: '/admin/schedule',
      icon: Calendar,
      adminOnly: true
    },
    {
      name: 'Gestione Ore',
      href: '/admin/hours',
      icon: Clock,
      adminOnly: true
    },
    {
      name: 'Configurazioni',
      href: '/admin/settings',
      icon: Settings,
      adminOnly: true
    }
  ]

  const visibleNavigation = navigation.filter(item => !item.adminOnly || isAdmin)

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center space-x-2 text-orange-600">
              <Pizza className="h-8 w-8" />
              <span className="text-xl font-bold">PizzaDOC</span>
            </Link>
          </div>

          <div className="hidden sm:flex sm:items-center sm:space-x-8">
            {visibleNavigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    pathname === item.href
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {item.name}
                </Link>
              )
            })}
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{session.user.username}</span>
              <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                {getRoleName(session.user.primaryRole)}
              </span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Esci
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="sm:hidden">
        <div className="pt-2 pb-3 space-y-1 bg-gray-50">
          {visibleNavigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'block px-3 py-2 text-base font-medium rounded-md transition-colors',
                  pathname === item.href
                    ? 'text-orange-600 bg-orange-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                )}
              >
                <Icon className="h-4 w-4 mr-2 inline" />
                {item.name}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
