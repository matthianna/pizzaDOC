'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { WifiOff, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme/theme-toggle'

const heroGlowStyle: React.CSSProperties = {
  background: `radial-gradient(ellipse 90% 70% at 50% -10%, color-mix(in srgb, var(--pd-accent) 28%, transparent), transparent 55%),
    radial-gradient(ellipse 50% 40% at 100% 80%, color-mix(in srgb, var(--pd-accent) 12%, transparent), transparent 50%)`,
}

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
    <div className="min-h-dvh flex flex-col relative overflow-hidden" style={{ background: 'var(--pd-bg)' }}>
      <div className="absolute inset-0 pointer-events-none" aria-hidden style={heroGlowStyle} />

      <div className="relative z-10 flex items-center justify-end px-4 sm:px-8 pt-safe py-4">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 pb-12">
        <div className="mx-auto w-full max-w-md text-center">
          <div className="mb-10">
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
            <p className="mt-3 text-sm sm:text-base" style={{ color: 'var(--pd-muted)' }}>
              Sistema di gestione del team
            </p>
          </div>

          <div className="mb-8">
            <h2 className="pd-display text-2xl font-semibold tracking-tight">Sei offline</h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--pd-muted)' }}>
              Connessione non trovata
            </p>
          </div>

          <div
            className="p-5 mb-6 text-left"
            style={{
              background: 'var(--pd-surface)',
              border: '1px solid var(--pd-border)',
              borderRadius: 'var(--pd-radius-lg)',
              boxShadow: 'var(--pd-shadow)',
            }}
          >
            <p className="text-sm leading-relaxed" style={{ color: 'var(--pd-muted)' }}>
              Pizza D.O.C. ha bisogno di una connessione per aggiornare i turni e le ore. Controlla il
              WiFi e riprova.
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={handleRetry}
              disabled={isRetrying}
              isLoading={isRetrying}
              leftIcon={!isRetrying ? <RefreshCcw className="h-4 w-4" /> : undefined}
              className="w-full py-4 text-sm font-semibold tracking-wide rounded-[var(--pd-radius)] shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--pd-accent)_55%,transparent)]"
            >
              {isRetrying ? 'Verifica in corso...' : 'Riprova'}
            </Button>

            <div
              className="px-4 py-3 text-xs font-medium rounded-[var(--pd-radius)]"
              style={{
                background: 'var(--pd-surface-muted)',
                color: 'var(--pd-muted)',
                border: '1px solid var(--pd-border)',
              }}
            >
              Ultimo sync: {lastSync || 'Nessuno'}
            </div>
          </div>

          <div
            className="mt-8 p-4 rounded-[var(--pd-radius)]"
            style={{
              background: 'var(--pd-accent-soft)',
              border: '1px solid color-mix(in srgb, var(--pd-accent) 20%, transparent)',
            }}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--pd-accent)' }}>
              Prova a riavviare il WiFi del tuo dispositivo
            </p>
          </div>

          <p className="mt-10 text-xs" style={{ color: 'var(--pd-muted)' }}>
            © {new Date().getFullYear()} Pizza D.O.C.
          </p>
        </div>
      </div>
    </div>
  )
}
