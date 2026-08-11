'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { WifiOff, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { DocumentTitle } from '@/components/layout/document-title'

export default function OfflinePage() {
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('pizzadoc_last_sync')
    if (stored) setLastSync(stored)

    const handleOnline = () => {
      window.location.href = '/dashboard'
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      const response = await fetch('/api/health', { cache: 'no-store' })
      if (response.ok) {
        window.location.href = '/dashboard'
      } else {
        setTimeout(() => setIsRetrying(false), 1000)
      }
    } catch {
      setTimeout(() => setIsRetrying(false), 1000)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--pd-bg)' }}>
      <DocumentTitle />
      <div className="flex items-center justify-end px-4 sm:px-8 pt-safe py-4">
        <ThemeToggle />
      </div>

      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 pb-12">
        <div className="mx-auto w-full max-w-md text-center space-y-8">
          <div>
            <div className="relative inline-flex mb-6">
              <div
                className="p-3"
                style={{
                  background: 'var(--pd-surface)',
                  boxShadow: 'var(--pd-shadow)',
                  border: '1px solid var(--pd-border)',
                  borderRadius: 'var(--pd-radius-lg)',
                }}
              >
                <Image
                  src="/logo-pizza-doc.png?v=3"
                  alt="Pizza D.O.C."
                  width={96}
                  height={96}
                  className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
                  priority
                />
              </div>
              <div
                className="absolute -bottom-1 -right-1 w-9 h-9 flex items-center justify-center rounded-full"
                style={{
                  background: 'var(--pd-surface)',
                  border: '1px solid var(--pd-border)',
                  boxShadow: 'var(--pd-shadow)',
                }}
              >
                <WifiOff className="h-4 w-4" style={{ color: 'var(--pd-danger)' }} />
              </div>
            </div>
            <h1 className="pd-display text-4xl sm:text-5xl font-semibold tracking-tight">
              Pizza D.O.C.
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--pd-muted)' }}>
              Sei offline
            </p>
          </div>

          <p className="text-sm leading-relaxed" style={{ color: 'var(--pd-muted)' }}>
            Serve una connessione per aggiornare turni e ore. Controlla il Wi‑Fi e riprova.
          </p>

          <div className="space-y-3">
            <Button
              onClick={handleRetry}
              disabled={isRetrying}
              isLoading={isRetrying}
              leftIcon={!isRetrying ? <RefreshCcw className="h-4 w-4" /> : undefined}
              className="w-full py-4 text-sm font-semibold rounded-[var(--pd-radius)]"
            >
              {isRetrying ? 'Verifica in corso...' : 'Riprova'}
            </Button>

            <p className="text-xs" style={{ color: 'var(--pd-muted)' }}>
              Ultimo sync: {lastSync || 'Nessuno'}
            </p>
          </div>

          <p className="text-xs pt-4" style={{ color: 'var(--pd-muted)' }}>
            © {new Date().getFullYear()} Pizza D.O.C.
          </p>
        </div>
      </div>
    </div>
  )
}
