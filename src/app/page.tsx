'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Image from 'next/image'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

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

  return (
    <div
      className="min-h-dvh flex items-center justify-center"
      style={{ background: 'var(--pd-bg)' }}
    >
      <div className="text-center px-6">
        <div
          className="inline-flex mb-5 p-3"
          style={{
            background: 'var(--pd-surface)',
            border: '1px solid var(--pd-border)',
            borderRadius: 'var(--pd-radius-lg)',
            boxShadow: 'var(--pd-shadow)',
          }}
        >
          <Image
            src="/logo-pizza-doc.png"
            alt="Pizza D.O.C."
            width={72}
            height={72}
            className="object-contain"
            priority
          />
        </div>
        <h1 className="pd-display text-3xl font-semibold tracking-tight">Pizza D.O.C.</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--pd-muted)' }}>
          Caricamento…
        </p>
      </div>
    </div>
  )
}
