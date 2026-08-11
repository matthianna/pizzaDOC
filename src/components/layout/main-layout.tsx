'use client'

import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Sidebar } from './sidebar'
import { MobileBottomNav } from './mobile-bottom-nav'
import { LoadingSpinner } from '../ui/loading-spinner'
import { isAdmin } from '@/lib/auth-utils'
import { useHaptics } from '@/hooks/use-haptics'
import { RefreshCw } from 'lucide-react'
import { BadgeManager } from '../pwa/badge-manager'
import { DocumentTitle } from '@/components/layout/document-title'
import { cn } from '@/lib/utils'

interface MainLayoutProps {
  children: React.ReactNode
  adminOnly?: boolean
  /** Optional browser-tab title override (pages own visible PageHeader). */
  title?: string
  /** @deprecated unused — kept for call-site compatibility */
  subtitle?: string
  /** @deprecated unused — kept for call-site compatibility */
  headerAction?: React.ReactNode
  /** Content max width — staff default 4xl, admin tools 6xl */
  contentWidth?: '4xl' | '6xl' | '7xl'
}

export function MainLayout({
  children,
  adminOnly = false,
  title,
  contentWidth = '4xl',
}: MainLayoutProps) {
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

  const maxW =
    contentWidth === '4xl' ? 'max-w-4xl' : contentWidth === '6xl' ? 'max-w-6xl' : 'max-w-7xl'

  return (
    <>
      <DocumentTitle override={title} />
      <BadgeManager />
      <Sidebar />
      <MobileBottomNav />

      <div
        className="min-h-dvh pd-app-shell lg:pl-64"
        style={{ background: 'var(--pd-bg)' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <main
          className="relative py-4 lg:py-6 pb-28 lg:pb-8 min-h-dvh overflow-x-hidden"
          style={
            pullDistance > 0 || isRefreshing
              ? {
                  transform: `translateY(${pullDistance}px)`,
                  transition:
                    pullDistance === 0 || isRefreshing
                      ? 'transform 0.3s cubic-bezier(0,0,0.2,1)'
                      : 'none',
                }
              : undefined
          }
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

          <div className={cn(maxW, 'mx-auto w-full px-4 sm:px-6 lg:px-8')}>
            <div
              className="lg:hidden mb-3"
              style={{ height: 'calc(3.5rem + env(safe-area-inset-top))' }}
              aria-hidden
            />
            <div key={pathname} className="animate-page-enter">
              {children}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
