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
  X,
  Shield,
  Banknote,
  CalendarDays,
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
    { name: 'Disponibilità', href: '/availability', icon: CalendarDays },
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
    { name: 'Riepilogo Ore', href: '/admin/hours-summary', icon: Clock },
    { name: 'Notifiche', href: '/notifications', icon: Bell },
    { name: 'Sostituzioni', href: '/admin/substitutions', icon: ArrowLeftRight },
    { name: 'Assenze', href: '/admin/absences', icon: Calendar },
    { name: 'Acconti', href: '/admin/advances', icon: Banknote },
    { name: 'Configurazioni', href: '/admin/settings', icon: Settings },
    { name: 'Sistema', href: '/admin/system', icon: Shield },
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
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Chiudi"
            onClick={() => setShowMore(false)}
          />
          <div
            className="relative p-5 pb-safe animate-slide-up max-h-[75dvh] overflow-y-auto"
            style={{
              background: 'var(--pd-surface)',
              borderTopLeftRadius: 'var(--pd-radius-xl)',
              borderTopRightRadius: 'var(--pd-radius-xl)',
              border: '1px solid var(--pd-border)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="pd-display text-lg font-semibold" style={{ color: 'var(--pd-text)' }}>
                Altro
              </p>
              <button
                type="button"
                onClick={() => setShowMore(false)}
                className="p-2 rounded-full"
                style={{ background: 'var(--pd-surface-muted)', color: 'var(--pd-muted)' }}
                aria-label="Chiudi menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-1">
              {moreItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setShowMore(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium"
                      style={{
                        background: isActive ? 'var(--pd-accent-soft)' : 'var(--pd-surface-muted)',
                        color: isActive ? 'var(--pd-accent)' : 'var(--pd-text)',
                        borderRadius: 'var(--pd-radius)',
                      }}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1">{item.name}</span>
                      {item.name === 'Notifiche' && unreadCount > 0 && (
                        <span
                          className="min-w-5 h-5 px-1.5 flex items-center justify-center text-[10px] font-bold rounded-full"
                          style={{ background: 'var(--pd-danger)', color: 'var(--pd-accent-fg)' }}
                        >
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
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
