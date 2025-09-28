'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Pizza } from 'lucide-react'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (session) {
      if (session.user.isFirstLogin) {
        router.push('/auth/first-login')
      } else {
        router.push('/dashboard')
      }
    } else {
      router.push('/auth/signin')
    }
  }, [session, status, router])

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-100">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="flex items-center space-x-2 text-orange-600">
            <Pizza className="h-16 w-16 animate-pulse" />
            <h1 className="text-4xl font-bold">PizzaDOC</h1>
          </div>
        </div>
        <p className="text-gray-600">Caricamento...</p>
      </div>
    </div>
  )
}