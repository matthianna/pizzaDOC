'use client'

import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Sidebar } from './sidebar'
import { MobileBottomNav } from './mobile-bottom-nav'
import { LoadingSpinner } from '../ui/loading-spinner'
import { isAdmin } from '@/lib/auth-utils'
import { NotificationBell } from '../notifications/notification-bell'
import Image from 'next/image'
import { useHaptics } from '@/hooks/use-haptics'
import { RefreshCw } from 'lucide-react'
import { BadgeManager } from '../pwa/badge-manager'
import { ThemeToggle } from '@/components/theme/theme-toggle'

interface MainLayoutProps {
  children: React.ReactNode
  adminOnly?: boolean
}

export function MainLayout({ children, adminOnly = false }: MainLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { lightClick, success } = useHaptics()

  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].pageY
    }
  }

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startY.current === 0 || isRefreshing) return

      const currentY = e.touches[0].pageY
      const distance = currentY - startY.current

      if (distance > 0 && window.scrollY === 0) {
        const dampenedDistance = Math.min(distance * 0.4, 80)
        if (dampenedDistance >= 60 && pullDistance < 60) {
          lightClick()
        }
        setPullDistance(dampenedDistance)
      }
    },
    [pullDistance, isRefreshing, lightClick]
  )

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= 60) {
      setIsRefreshing(true)
      setPullDistance(40)
      router.refresh()
      setTimeout(() => {
        setIsRefreshing(false)
        setPullDistance(0)
        startY.current = 0
        success()
      }, 1000)
    } else {
      setPullDistance(0)
      startY.current = 0
    }
  }, [pullDistance, router, success])

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    if (session.user.isFirstLogin) {
      router.push('/auth/first-login')
      return
    }

    if (adminOnly && !isAdmin(session)) {
      router.push('/dashboard')
      return
    }
  }, [session, status, router, adminOnly])

  if (status === 'loading') {
    return <LoadingSpinner fullScreen text="Caricamento..." />
  }

  if (!session || session.user.isFirstLogin) {
    return null
  }

  if (adminOnly && !isAdmin(session)) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: 'var(--pd-bg)' }}>
      <BadgeManager />
      <Sidebar />

      <div
        className="lg:hidden fixed top-0 left-0 right-0 h-16 z-40 px-4 flex items-center justify-between border-b pt-safe"
        style={{
          background: 'color-mix(in srgb, var(--pd-surface) 92%, transparent)',
          borderColor: 'var(--pd-border)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0 pl-12">
          <Image
            src="/logo-pizza-doc.png"
            alt="Pizza D.O.C."
            width={160}
            height={40}
            className="h-8 w-auto max-h-8 max-w-[min(160px,45vw)] object-contain object-left"
            priority
          />
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <NotificationBell />
        </div>
      </div>

      <div
        className="flex-1 lg:pl-64"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <main
          className="relative py-6 pb-24 lg:pb-6 min-h-screen"
          style={{
            transform: `translateY(${pullDistance}px)`,
            transition:
              pullDistance === 0 || isRefreshing ? 'transform 0.3s cubic-bezier(0,0,0.2,1)' : 'none',
          }}
        >
          <div
            className={`pull-indicator transition-opacity duration-200 ${pullDistance > 20 ? 'opacity-100' : 'opacity-0'} ${pullDistance >= 60 ? 'pulling' : ''} ${isRefreshing ? 'refreshing' : ''}`}
            style={{ transform: `translateY(${-40 + Math.min(pullDistance, 40)}px)` }}
          >
            <RefreshCw
              className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : ''}`}
              style={{ color: 'var(--pd-accent)' }}
            />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 lg:pl-8">
            <div className="lg:hidden h-16 mb-4" />
            <div key={pathname} className="animate-page-enter">
              {children}
            </div>
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
