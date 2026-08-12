'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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
  MoreHorizontal,
  Bell,
  X,
  Shield,
  Banknote,
  CalendarDays,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isAdmin } from '@/lib/auth-utils'
import { useNotifications } from '../notifications/notification-provider'
import { useHaptics } from '@/hooks/use-haptics'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

export function MobileBottomNav() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { unreadCount } = useNotifications()
  const { lightClick } = useHaptics()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setShowMore(false)
  }, [pathname])

  useEffect(() => {
    if (!showMore) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [showMore])

  if (!session || !mounted) return null

  const isUserAdmin = isAdmin(session)

  const employeeNav: NavItem[] = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Settimana', href: '/weekly-plan', icon: Calendar },
    { name: 'Mio Piano', href: '/schedule', icon: LayoutGrid },
    { name: 'Disponib.', href: '/availability', icon: CalendarDays },
    { name: 'Altro', href: '#more', icon: MoreHorizontal },
  ]

  const adminNav: NavItem[] = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Piano', href: '/admin/schedule', icon: LayoutGrid },
    { name: 'Assenze', href: '/admin/absences', icon: Calendar },
    { name: 'Utenti', href: '/admin/users', icon: Users },
    { name: 'Altro', href: '#more', icon: MoreHorizontal },
  ]

  const employeeMoreItems: NavItem[] = [
    { name: 'Le mie ore', href: '/hours', icon: Clock },
    { name: 'Notifiche', href: '/notifications', icon: Bell },
    { name: 'Sostituzioni', href: '/substitution-requests', icon: ArrowLeftRight },
    { name: 'Assenze', href: '/absences', icon: Calendar },
    { name: 'Disponibilità utenti', href: '/availability-overview', icon: Users },
    { name: 'Profilo', href: `/profile/${session.user.id}`, icon: User },
  ]

  const adminMoreItems: NavItem[] = [
    { name: 'Inserimento ore', href: '/admin/hours', icon: Clock },
    { name: 'Resoconto ore', href: '/admin/hours-summary', icon: Clock },
    { name: 'Notifiche', href: '/notifications', icon: Bell },
    { name: 'Sostituzioni', href: '/admin/substitutions', icon: ArrowLeftRight },
    { name: 'Assenze', href: '/admin/absences', icon: Calendar },
    { name: 'Acconti', href: '/admin/advances', icon: Banknote },
    { name: 'Configurazioni', href: '/admin/settings', icon: Settings },
    { name: 'Sistema', href: '/admin/system', icon: Shield },
  ]

  const navigation = isUserAdmin ? adminNav : employeeNav
  const moreItemsRaw = isUserAdmin ? adminMoreItems : employeeMoreItems
  const moreItems =
    isUserAdmin || session.user.trackHours
      ? moreItemsRaw
      : moreItemsRaw.filter((item) => item.href !== '/hours')

  return createPortal(
    <>
      {showMore && (
        <div className="lg:hidden fixed inset-0 z-[100000] flex flex-col justify-end">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: 'rgba(28, 25, 23, 0.4)' }}
            aria-label="Chiudi"
            onClick={() => {
              lightClick()
              setShowMore(false)
            }}
          />
          <div
            className="relative mx-3 mb-3 overflow-hidden animate-slide-up max-h-[min(75dvh,32rem)] flex flex-col"
            style={{
              backgroundColor: 'var(--pd-surface)',
              borderRadius: 'var(--pd-radius-xl)',
              border: '1px solid var(--pd-border)',
              boxShadow: 'var(--pd-shadow)',
              marginBottom: 'calc(5.25rem + env(safe-area-inset-bottom))',
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: '1px solid var(--pd-border)' }}
            >
              <div>
                <p className="pd-display text-lg font-semibold" style={{ color: 'var(--pd-text)' }}>
                  Altro
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                  Scorciatoie e impostazioni
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  lightClick()
                  setShowMore(false)
                }}
                className="p-2.5 pd-press"
                style={{
                  background: 'var(--pd-surface-muted)',
                  color: 'var(--pd-muted)',
                  borderRadius: 'var(--pd-radius)',
                }}
                aria-label="Chiudi menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="overflow-y-auto custom-scrollbar p-2 pb-safe space-y-0.5">
              {moreItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => {
                        lightClick()
                        setShowMore(false)
                      }}
                      className="flex items-center gap-3 px-3.5 py-3 text-sm font-medium pd-press"
                      style={{
                        background: isActive ? 'var(--pd-accent-soft)' : 'transparent',
                        color: isActive ? 'var(--pd-accent)' : 'var(--pd-text)',
                        borderRadius: 'var(--pd-radius)',
                      }}
                    >
                      <span
                        className="flex h-9 w-9 items-center justify-center shrink-0"
                        style={{
                          background: isActive ? 'var(--pd-surface)' : 'var(--pd-surface-muted)',
                          borderRadius: 'var(--pd-radius)',
                          color: isActive ? 'var(--pd-accent)' : 'var(--pd-muted)',
                        }}
                      >
                        <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                      </span>
                      <span className="flex-1 truncate">{item.name}</span>
                      {item.name === 'Notifiche' && unreadCount > 0 ? (
                        <span
                          className="min-w-5 h-5 px-1.5 flex items-center justify-center text-[10px] font-bold rounded-full"
                          style={{ background: 'var(--pd-danger)', color: 'var(--pd-accent-fg)' }}
                        >
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
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
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[90] pointer-events-none"
        style={{
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
          paddingLeft: '0.75rem',
          paddingRight: '0.75rem',
        }}
      >
        <div
          className="pointer-events-auto flex items-stretch gap-0.5 px-1.5 py-1.5"
          style={{
            background: 'color-mix(in srgb, var(--pd-surface) 92%, transparent)',
            border: '1px solid var(--pd-border)',
            borderRadius: '1.25rem',
            boxShadow: '0 8px 28px -12px rgba(28, 25, 23, 0.28)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
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
                  lightClick()
                  if (item.href === '#more') {
                    e.preventDefault()
                    setShowMore((v) => !v)
                  } else {
                    setShowMore(false)
                  }
                }}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 py-1.5 px-0.5 pd-press"
                style={{ color: isActive ? 'var(--pd-accent)' : 'var(--pd-muted)' }}
                aria-current={isActive ? 'page' : undefined}
              >
                <span
                  className="relative flex items-center justify-center h-8 w-8"
                  style={{
                    borderRadius: '999px',
                    background: isActive ? 'var(--pd-accent-soft)' : 'transparent',
                  }}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.35 : 1.9} />
                  {item.name === 'Altro' && unreadCount > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 min-w-[0.95rem] h-[0.95rem] px-0.5 flex items-center justify-center text-[8px] font-bold rounded-full border-2"
                      style={{
                        background: 'var(--pd-danger)',
                        color: 'var(--pd-accent-fg)',
                        borderColor: 'var(--pd-surface)',
                      }}
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'text-[10px] leading-tight truncate max-w-full px-0.5',
                    isActive ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {item.name}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>,
    document.body
  )
}
