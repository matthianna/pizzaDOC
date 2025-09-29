'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Sidebar } from './sidebar'
import { LoadingSpinner } from '../ui/loading-spinner'
import { isAdmin } from '@/lib/auth-utils'

interface MainLayoutProps {
  children: React.ReactNode
  adminOnly?: boolean
}

export function MainLayout({ children, adminOnly = false }: MainLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

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
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      {/* Main content */}
      <div className="lg:pl-64">
        <main className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 lg:pl-8">
            {/* Mobile header space */}
            <div className="lg:hidden h-16 mb-4"></div>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
