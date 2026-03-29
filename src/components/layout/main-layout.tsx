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
import { AppEngagementBanner } from '../pwa/app-engagement-banner'

interface MainLayoutProps {
  children: React.ReactNode
  adminOnly?: boolean
}

export function MainLayout({ children, adminOnly = false }: MainLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { lightClick, success } = useHaptics()

  // Pull to refresh state
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].pageY
    }
  }

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === 0 || isRefreshing) return

    const currentY = e.touches[0].pageY
    const distance = currentY - startY.current

    if (distance > 0 && window.scrollY === 0) {
      // Apply resistance
      const dampenedDistance = Math.min(distance * 0.4, 80)

      // Light haptic when reaching threshold for the first time in this swipe
      if (dampenedDistance >= 60 && pullDistance < 60) {
        lightClick()
      }

      setPullDistance(dampenedDistance)
    }
  }, [pullDistance, isRefreshing, lightClick])

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= 60) {
      setIsRefreshing(true)
      setPullDistance(40)

      // Trigger refresh
      router.refresh()

      // Simulate/Wait for refresh completion perception
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
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-x-hidden">
      <BadgeManager />
      <Sidebar />

      {/* Mobile header - Moved outside transformed container */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center overflow-hidden shadow-sm">
            <Image
              src="/logo.png"
              alt="Logo"
              width={20}
              height={20}
              className="object-contain"
              unoptimized
            />
          </div>
          <span className="font-black text-orange-600 text-lg tracking-tight">PizzaDOC</span>
        </div>
        <NotificationBell />
      </div>

      {/* Main content */}
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
            transition: pullDistance === 0 || isRefreshing ? 'transform 0.3s cubic-bezier(0,0,0.2,1)' : 'none'
          }}
        >
          {/* Pull to refresh indicator */}
          <div
            className={`pull-indicator transition-opacity duration-200 ${pullDistance > 20 ? 'opacity-100' : 'opacity-0'} ${pullDistance >= 60 ? 'pulling' : ''} ${isRefreshing ? 'refreshing' : ''}`}
            style={{ transform: `translateY(${-40 + Math.min(pullDistance, 40)}px)` }}
          >
            <RefreshCw className={`w-6 h-6 text-orange-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 lg:pl-8">
            {/* Spacer for mobile header */}
            <div className="lg:hidden h-16 mb-4"></div>

            <AppEngagementBanner />

            <div key={pathname} className="animate-page-enter">
              {children}
            </div>
          </div>
        </main>
      </div>
      {/* Mobile bottom navigation */}
      <MobileBottomNav />
    </div>
  )
}
