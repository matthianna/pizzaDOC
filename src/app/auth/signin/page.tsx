'use client'

import { useState } from 'react'
import Image from 'next/image'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { DocumentTitle } from '@/components/layout/document-title'

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

export default function SignInPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { ToastContainer } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        username: username.trim(),
        password,
        redirect: false,
      })

      if (result?.error) {
        if (result.error === 'CredentialsSignin') {
          setError('Nome utente o password non corretti')
        } else {
          setError('Errore durante il login. Riprova.')
        }
      } else {
        console.log('Login successful, checking session...')
        setTimeout(async () => {
          try {
            const session = await getSession()
            console.log('Session after login:', session?.user)

            if (session?.user.isFirstLogin) {
              console.log('First login detected, redirecting to change password')
              router.push('/auth/first-login')
            } else {
              console.log('Regular login, redirecting to dashboard')
              router.push('/dashboard')
            }

            window.location.reload()
          } catch (error) {
            console.error('Error getting session:', error)
            router.push('/dashboard')
          }
        }, 500)
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Errore durante il login. Riprova.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden" style={{ background: 'var(--pd-bg)' }}>
      <DocumentTitle />
      <div className="absolute inset-0 pointer-events-none" aria-hidden style={heroGlowStyle} />

      <div className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 pb-12 pt-safe">
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

          {error && (
            <div
              className="mb-5 p-4 rounded-[var(--pd-radius)]"
              style={{
                background: 'var(--pd-danger-soft)',
                border: '1px solid color-mix(in srgb, var(--pd-danger) 25%, transparent)',
              }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--pd-danger)' }}>
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="block text-xs font-semibold px-0.5"
                style={{ color: 'var(--pd-muted)' }}
              >
                Nome utente
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="es. mario.rossi"
                autoComplete="username"
                className="w-full px-4 py-3.5 text-sm font-medium outline-none"
                style={inputStyle}
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-xs font-semibold px-0.5"
                style={{ color: 'var(--pd-muted)' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3.5 pr-12 text-sm font-medium outline-none"
                  style={inputStyle}
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
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              isLoading={isLoading}
              className="w-full py-4 text-sm font-semibold tracking-wide rounded-[var(--pd-radius)] shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--pd-accent)_55%,transparent)]"
            >
              {isLoading ? 'Accesso in corso...' : 'Accedi'}
            </Button>
          </form>

          <p className="mt-10 text-center text-xs" style={{ color: 'var(--pd-muted)' }}>
            © {new Date().getFullYear()} Pizza D.O.C.
          </p>
        </div>
      </div>

      <ToastContainer />
    </div>
  )
}
