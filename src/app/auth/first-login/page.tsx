'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useSession, signOut, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { cn } from '@/lib/utils'

const inputStyle: React.CSSProperties = {
  background: 'var(--pd-surface)',
  color: 'var(--pd-text)',
  border: '1px solid var(--pd-border-strong)',
  boxShadow: 'var(--pd-shadow)',
  borderRadius: 'var(--pd-radius)',
}

const heroGlowStyle: React.CSSProperties = {
  background: `radial-gradient(ellipse 90% 70% at 50% -10%, color-mix(in srgb, var(--pd-accent) 28%, transparent), transparent 55%),
    radial-gradient(ellipse 50% 40% at 100% 80%, color-mix(in srgb, var(--pd-accent) 12%, transparent), transparent 50%)`,
}

export default function FirstLoginPage() {
  const { data: session } = useSession()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { showToast, ToastContainer } = useToast()

  const isValidLength = password.length >= 6
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0
  const canSubmit = isValidLength && passwordsMatch && !isLoading

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('Le password non coincidono')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: session?.user.id,
          newPassword: password,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        showToast('Password cambiata con successo!', 'success')

        const username = session?.user.username

        if (username) {
          setTimeout(async () => {
            await signOut({ redirect: false })

            const result = await signIn('credentials', {
              username: username,
              password: password,
              redirect: false,
            })

            if (result?.ok) {
              router.push('/dashboard')
              router.refresh()
            } else {
              showToast('Errore durante il re-login. Effettua il login manualmente.', 'error')
              router.push('/auth/signin')
            }
          }, 1500)
        } else {
          setTimeout(() => {
            router.push('/auth/signin')
          }, 1500)
        }
      } else {
        setError(data.error || 'Errore durante il cambio password')
        showToast(data.error || 'Errore durante il cambio password', 'error')
      }
    } catch (error) {
      setError('Errore di connessione. Riprova.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden" style={{ background: 'var(--pd-bg)' }}>
      <div className="absolute inset-0 pointer-events-none" aria-hidden style={heroGlowStyle} />

      <div className="relative z-10 flex items-center justify-end px-4 sm:px-8 pt-safe py-4">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 pb-12">
        <div className="mx-auto w-full max-w-md">
          <div className="text-center mb-10">
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

          <div className="text-center mb-8">
            <h2 className="pd-display text-2xl font-semibold tracking-tight">Benvenuto</h2>
            {session?.user.username && (
              <p className="mt-2 text-sm font-medium" style={{ color: 'var(--pd-accent)' }}>
                Ciao, {session.user.username}
              </p>
            )}
            <p className="mt-2 text-sm" style={{ color: 'var(--pd-muted)' }}>
              Prima di iniziare, imposta la tua password personale
            </p>
          </div>

          {error && (
            <div
              className="mb-5 p-4 rounded-[var(--pd-radius)] flex items-center gap-3"
              style={{
                background: 'var(--pd-danger-soft)',
                border: '1px solid color-mix(in srgb, var(--pd-danger) 25%, transparent)',
              }}
            >
              <X className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--pd-danger)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--pd-danger)' }}>
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-xs font-semibold px-0.5"
                style={{ color: 'var(--pd-muted)' }}
              >
                Nuova password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 6 caratteri"
                  autoComplete="new-password"
                  className="w-full px-4 py-3.5 pr-12 text-sm font-medium outline-none"
                  style={{
                    ...inputStyle,
                    borderColor:
                      password.length > 0
                        ? isValidLength
                          ? 'var(--pd-success)'
                          : 'var(--pd-danger)'
                        : 'var(--pd-border-strong)',
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 px-3.5 flex items-center"
                  style={{ color: 'var(--pd-muted)' }}
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {password.length > 0 && (
                <p
                  className="text-xs font-medium px-0.5"
                  style={{ color: isValidLength ? 'var(--pd-success)' : 'var(--pd-danger)' }}
                >
                  {isValidLength
                    ? password.length >= 8
                      ? 'Password forte'
                      : 'Password valida'
                    : `Almeno 6 caratteri (${password.length}/6)`}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold px-0.5"
                style={{ color: 'var(--pd-muted)' }}
              >
                Conferma password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ripeti la password"
                  autoComplete="new-password"
                  className="w-full px-4 py-3.5 pr-12 text-sm font-medium outline-none"
                  style={{
                    ...inputStyle,
                    borderColor:
                      confirmPassword.length > 0
                        ? passwordsMatch
                          ? 'var(--pd-success)'
                          : 'var(--pd-danger)'
                        : 'var(--pd-border-strong)',
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 px-3.5 flex items-center"
                  style={{ color: 'var(--pd-muted)' }}
                  aria-label={showConfirmPassword ? 'Nascondi password' : 'Mostra password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <div
                  className={cn('flex items-center gap-2 px-0.5 text-xs font-medium')}
                  style={{ color: passwordsMatch ? 'var(--pd-success)' : 'var(--pd-danger)' }}
                >
                  {passwordsMatch ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Le password coincidono</span>
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" />
                      <span>Le password non coincidono</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={!canSubmit}
              isLoading={isLoading}
              className="w-full py-4 text-sm font-semibold tracking-wide rounded-[var(--pd-radius)] shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--pd-accent)_55%,transparent)]"
            >
              {isLoading ? 'Aggiornamento...' : 'Imposta password'}
            </Button>
          </form>

          <div
            className="mt-6 p-4 rounded-[var(--pd-radius)] flex items-start gap-3"
            style={{
              background: 'var(--pd-success-soft)',
              border: '1px solid color-mix(in srgb, var(--pd-success) 25%, transparent)',
            }}
          >
            <Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--pd-success)' }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--pd-success)' }}>
                Accesso automatico
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                Dopo il cambio password, entrerai direttamente nel sistema.
              </p>
            </div>
          </div>

          <p className="mt-10 text-center text-xs" style={{ color: 'var(--pd-muted)' }}>
            © {new Date().getFullYear()} Pizza D.O.C.
          </p>
        </div>
      </div>

      <ToastContainer />
    </div>
  )
}
