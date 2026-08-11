'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Calendar,
  Clock,
  ArrowLeftRight,
  User,
  Settings,
  Users,
  LayoutGrid,
  Menu,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isAdmin } from '@/lib/auth-utils'
import { useState } from 'react'
import { useNotifications } from '../notifications/notification-provider'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

export function MobileBottomNav() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)
  const { unreadCount } = useNotifications()

  if (!session) return null

  const isUserAdmin = isAdmin(session)

  const employeeNav: NavItem[] = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Settimana', href: '/weekly-plan', icon: Calendar },
    { name: 'Mio Piano', href: '/schedule', icon: LayoutGrid },
    { name: 'Disponibilità', href: '/availability', icon: Calendar },
    { name: 'Altro', href: '#more', icon: Menu },
  ]

  const adminNav: NavItem[] = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Settimana', href: '/weekly-plan', icon: Calendar },
    { name: 'Mio Piano', href: '/admin/schedule', icon: LayoutGrid },
    { name: 'Utenti', href: '/admin/users', icon: Users },
    { name: 'Altro', href: '#more', icon: Menu },
  ]

  const employeeMoreItems: NavItem[] = [
    { name: 'Le mie ore', href: '/hours', icon: Clock },
    { name: 'Notifiche', href: '/notifications', icon: Bell },
    { name: 'Sostituzioni', href: '/substitution-requests', icon: ArrowLeftRight },
    { name: 'Assenze', href: '/absences', icon: Calendar },
    { name: 'Disponibilità Utenti', href: '/availability-overview', icon: Users },
    { name: 'Profilo', href: `/profile/${session.user.id}`, icon: User },
  ]

  const adminMoreItems: NavItem[] = [
    { name: 'Gestione Ore', href: '/admin/hours', icon: Clock },
    { name: 'Notifiche', href: '/notifications', icon: Bell },
    { name: 'Sostituzioni', href: '/admin/substitutions', icon: ArrowLeftRight },
    { name: 'Assenze', href: '/admin/absences', icon: Calendar },
    { name: 'Riepilogo Ore', href: '/admin/hours-summary', icon: Clock },
    { name: 'Configurazioni', href: '/admin/settings', icon: Settings },
    { name: 'Profilo', href: `/profile/${session.user.id}`, icon: User },
  ]

  const navigation = isUserAdmin ? adminNav : employeeNav
  const moreItemsRaw = isUserAdmin ? adminMoreItems : employeeMoreItems
  const moreItems =
    isUserAdmin || session.user.trackHours
      ? moreItemsRaw
      : moreItemsRaw.filter((item) => item.href !== '/hours')

  return (
    <>
      {showMore && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowMore(false)}
        />
      )}

      {showMore && (
        <div
          className="lg:hidden fixed bottom-20 left-4 right-4 z-50 p-2 animate-slide-up"
          style={{
            background: 'var(--pd-surface)',
            borderRadius: 'var(--pd-radius-xl)',
            boxShadow: 'var(--pd-shadow)',
            border: '1px solid var(--pd-border)',
          }}
        >
          <div className="grid grid-cols-3 gap-1">
            {moreItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setShowMore(false)}
                  className="flex flex-col items-center justify-center p-3 transition-colors"
                  style={{
                    borderRadius: 'var(--pd-radius)',
                    background: isActive ? 'var(--pd-accent-soft)' : 'transparent',
                    color: isActive ? 'var(--pd-accent)' : 'var(--pd-muted)',
                  }}
                >
                  <div className="relative">
                    <Icon className="h-6 w-6 mb-1" />
                    {item.name === 'Notifiche' && unreadCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full"
                        style={{ background: 'var(--pd-danger)', color: 'var(--pd-accent-fg)' }}
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-center">{item.name}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t pb-safe"
        style={{
          background: 'color-mix(in srgb, var(--pd-surface) 94%, transparent)',
          borderColor: 'var(--pd-border)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <div className="flex items-center justify-around h-16">
          {navigation.map((item) => {
            const isActive =
              item.href === '#more'
                ? showMore
                : pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={(e) => {
                  if (item.href === '#more') {
                    e.preventDefault()
                    setShowMore(!showMore)
                  } else {
                    setShowMore(false)
                  }
                }}
                className="flex flex-col items-center justify-center flex-1 h-full transition-all active:scale-95"
                style={{ color: isActive ? 'var(--pd-accent)' : 'var(--pd-muted)' }}
              >
                <div
                  className={cn(
                    'relative flex items-center justify-center w-12 h-7 transition-all',
                    isActive && 'scale-105'
                  )}
                  style={{
                    borderRadius: 'var(--pd-radius)',
                    background: isActive ? 'var(--pd-accent-soft)' : 'transparent',
                  }}
                >
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                  {item.name === 'Altro' && unreadCount > 0 && (
                    <span
                      className="absolute top-1 right-2 w-2.5 h-2.5 rounded-full border-2"
                      style={{
                        background: 'var(--pd-danger)',
                        borderColor: 'var(--pd-surface)',
                      }}
                    />
                  )}
                </div>
                <span className={cn('text-[10px] mt-0.5 font-medium', isActive && 'font-semibold')}>
                  {item.name}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
