'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '@/components/design-preview/theme-toggle'
import { PreviewButton } from '@/components/design-preview/preview-button'
import { useDesignPreviewTheme } from '@/components/design-preview/theme-provider'

export function SignInView() {
  const { variant } = useDesignPreviewTheme()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const tagline =
    variant === 'linea'
      ? 'Turni, ore e disponibilità — un solo posto'
      : variant === 'brace'
        ? 'Il piano di lavoro, anche a fine servizio'
        : 'Sistema di gestione del team'

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none pd-hero-glow" aria-hidden />

      <div className="relative z-10 flex items-center justify-between px-4 sm:px-8 pt-safe py-4">
        <Link
          href="/design-preview"
          className="inline-flex items-center gap-2 text-sm font-semibold pd-press"
          style={{ color: 'var(--pd-muted)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Anteprima
        </Link>
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 pb-12 pd-page-enter">
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
              {tagline}
            </p>
          </div>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
            }}
          >
            <div className="space-y-2">
              <label
                htmlFor="preview-username"
                className="block text-xs font-semibold px-0.5"
                style={{ color: 'var(--pd-muted)' }}
              >
                Nome utente
              </label>
              <input
                id="preview-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="es. mario.rossi"
                autoComplete="username"
                className="w-full px-4 py-3.5 text-sm font-medium outline-none"
                style={{
                  background: 'var(--pd-surface)',
                  color: 'var(--pd-text)',
                  border: '1px solid var(--pd-border-strong)',
                  boxShadow: 'var(--pd-shadow)',
                  borderRadius: 'var(--pd-radius)',
                }}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="preview-password"
                className="block text-xs font-semibold px-0.5"
                style={{ color: 'var(--pd-muted)' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="preview-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3.5 pr-12 text-sm font-medium outline-none"
                  style={{
                    background: 'var(--pd-surface)',
                    color: 'var(--pd-text)',
                    border: '1px solid var(--pd-border-strong)',
                    boxShadow: 'var(--pd-shadow)',
                    borderRadius: 'var(--pd-radius)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3.5 flex items-center"
                  style={{ color: 'var(--pd-muted)' }}
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <PreviewButton type="submit" className="w-full py-4 text-sm tracking-wide">
              Accedi
            </PreviewButton>
          </form>

          <p className="mt-8 text-center text-xs" style={{ color: 'var(--pd-muted)' }}>
            Anteprima statica — nessun accesso reale
          </p>
        </div>
      </div>
    </div>
  )
}
