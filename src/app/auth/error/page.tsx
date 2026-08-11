'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'
import { ThemeToggle } from '@/components/theme/theme-toggle'

const heroGlowStyle: React.CSSProperties = {
  background: `radial-gradient(ellipse 90% 70% at 50% -10%, color-mix(in srgb, var(--pd-accent) 28%, transparent), transparent 55%),
    radial-gradient(ellipse 50% 40% at 100% 80%, color-mix(in srgb, var(--pd-accent) 12%, transparent), transparent 50%)`,
}

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'CredentialsSignin':
        return {
          title: 'Credenziali non valide',
          message: 'Nome utente o password non corretti. Verifica i tuoi dati e riprova.',
        }
      case 'AccessDenied':
        return {
          title: 'Accesso negato',
          message: 'Il tuo account potrebbe essere disattivato. Contatta un amministratore.',
        }
      case 'Configuration':
        return {
          title: 'Errore di configurazione',
          message: 'Si è verificato un problema con la configurazione del sistema.',
        }
      default:
        return {
          title: 'Errore di autenticazione',
          message: 'Si è verificato un errore durante il login. Riprova più tardi.',
        }
    }
  }

  const errorInfo = getErrorMessage(error)

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden" style={{ background: 'var(--pd-bg)' }}>
      <div className="absolute inset-0 pointer-events-none" aria-hidden style={heroGlowStyle} />

      <div className="relative z-10 flex items-center justify-end px-4 sm:px-8 pt-safe py-4">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 pb-12">
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="text-center">
            <div
              className="inline-flex mb-6 p-3"
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
            <h1 className="pd-display text-4xl sm:text-5xl font-semibold tracking-tight">
              Pizza D.O.C.
            </h1>
            <p className="mt-3 text-sm sm:text-base" style={{ color: 'var(--pd-muted)' }}>
              Sistema di gestione del team
            </p>
          </div>

          <div
            className="p-6 space-y-4"
            style={{
              background: 'var(--pd-surface)',
              border: '1px solid var(--pd-border)',
              borderRadius: 'var(--pd-radius-lg)',
              boxShadow: 'var(--pd-shadow)',
            }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 flex-shrink-0 mt-0.5" style={{ color: 'var(--pd-danger)' }} />
              <div>
                <h2 className="pd-display text-xl font-semibold tracking-tight">
                  Ops! Qualcosa è andato storto
                </h2>
                <h3 className="text-base font-semibold mt-3" style={{ color: 'var(--pd-text)' }}>
                  {errorInfo.title}
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--pd-muted)' }}>
                  {errorInfo.message}
                </p>
              </div>
            </div>

            {error && (
              <div
                className="rounded-[var(--pd-radius)] p-3"
                style={{ background: 'var(--pd-surface-muted)' }}
              >
                <p className="text-xs" style={{ color: 'var(--pd-muted)' }}>
                  Codice errore:{' '}
                  <code
                    className="font-mono px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--pd-bg)', color: 'var(--pd-text)' }}
                  >
                    {error}
                  </code>
                </p>
              </div>
            )}

            <Link
              href="/auth/signin"
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors rounded-[var(--pd-radius)]"
              style={{
                background: 'var(--pd-accent)',
                color: 'var(--pd-accent-fg)',
                boxShadow: '0 8px 24px -8px color-mix(in srgb, var(--pd-accent) 55%, transparent)',
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Torna al login
            </Link>

            <p className="text-center text-xs" style={{ color: 'var(--pd-muted)' }}>
              Se il problema persiste, contatta un amministratore
            </p>
          </div>

          <div
            className="p-6"
            style={{
              background: 'var(--pd-surface)',
              border: '1px solid var(--pd-border)',
              borderRadius: 'var(--pd-radius-lg)',
              boxShadow: 'var(--pd-shadow)',
            }}
          >
            <h3 className="pd-display text-lg font-semibold mb-3">Suggerimenti</h3>
            <ul className="text-sm space-y-2.5" style={{ color: 'var(--pd-muted)' }}>
              <li className="flex items-start gap-2.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                  style={{ background: 'var(--pd-accent)' }}
                />
                <span>Verifica che il nome utente sia scritto correttamente (maiuscole/minuscole)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                  style={{ background: 'var(--pd-accent)' }}
                />
                <span>Se è il tuo primo accesso, la password è il tuo nome utente in minuscolo</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                  style={{ background: 'var(--pd-accent)' }}
                />
                <span>Assicurati che il tuo account sia attivo</span>
              </li>
            </ul>
          </div>

          <p className="text-center text-xs" style={{ color: 'var(--pd-muted)' }}>
            © {new Date().getFullYear()} Pizza D.O.C.
          </p>
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--pd-bg)' }}>
      <div className="text-center">
        <div
          className="animate-spin rounded-full h-8 w-8 border-2 mx-auto"
          style={{ borderColor: 'var(--pd-border)', borderTopColor: 'var(--pd-accent)' }}
        />
        <p className="mt-4 text-sm" style={{ color: 'var(--pd-muted)' }}>
          Caricamento...
        </p>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ErrorContent />
    </Suspense>
  )
}
