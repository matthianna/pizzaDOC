'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ThemeToggle } from '@/components/design-preview/theme-toggle'

const DESIGNS = [
  {
    id: 'fornace',
    name: 'Fornace',
    tag: 'A',
    href: '/design-preview/signin',
    dashboard: '/design-preview/dashboard',
    availability: '/design-preview/availability',
    summary:
      'Cucina calda: carta, serif espressiva (Fraunces), arancio brand, atmosfera soft.',
    traits: ['Caldo', 'Brand-first', 'Serif'],
  },
  {
    id: 'linea',
    name: 'Linea',
    tag: 'B',
    href: '/design-preview/linea/signin',
    dashboard: '/design-preview/linea/dashboard',
    availability: '/design-preview/linea/availability',
    summary:
      'Ops moderno: bianco/slate, angoli stretti, tipografia geometric (Outfit), densità tablet.',
    traits: ['Fresco', 'Operativo', 'Sans'],
  },
  {
    id: 'brace',
    name: 'Brace',
    tag: 'C',
    href: '/design-preview/brace/signin',
    dashboard: '/design-preview/brace/dashboard',
    availability: '/design-preview/brace/availability',
    summary:
      'Notte di servizio: contrasto alto, ember, serif corsiva (Instrument), luce di forno.',
    traits: ['Drammatico', 'Notturno', 'Serif italic'],
  },
] as const

export default function DesignPreviewIndexPage() {
  return (
    <div className="min-h-dvh px-4 py-10 sm:px-8 lg:px-12 pd-page-enter">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-[0.18em] mb-3"
              style={{ color: 'var(--pd-accent)' }}
            >
              Scegli il design
            </p>
            <h1 className="pd-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
              Pizza D.O.C.
            </h1>
            <p className="mt-3 text-base max-w-lg leading-relaxed" style={{ color: 'var(--pd-muted)' }}>
              Tre direzioni distinte. Aprine una, prova Chiaro/Scuro, poi dimmi quale
              vuoi applicare a tutta l&apos;app.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <ul className="space-y-4">
          {DESIGNS.map((design) => (
            <li
              key={design.id}
              className="p-5 sm:p-6"
              style={{
                background: 'var(--pd-surface)',
                border: '1px solid var(--pd-border)',
                borderRadius: 'var(--pd-radius-lg)',
                boxShadow: 'var(--pd-shadow)',
              }}
            >
              <div className="flex items-start gap-4 mb-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center text-sm font-bold"
                  style={{
                    background: 'var(--pd-accent-soft)',
                    color: 'var(--pd-accent)',
                    borderRadius: 'var(--pd-radius)',
                  }}
                >
                  {design.tag}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="pd-display text-2xl font-semibold tracking-tight">
                    {design.name}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--pd-muted)' }}>
                    {design.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {design.traits.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] font-semibold px-2.5 py-1"
                        style={{
                          background: 'var(--pd-surface-muted)',
                          color: 'var(--pd-muted)',
                          borderRadius: 'var(--pd-radius-pill)',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={design.href}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold pd-press pd-btn-primary"
                >
                  Apri Accesso
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={design.dashboard}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold pd-press"
                  style={{
                    background: 'var(--pd-surface-muted)',
                    color: 'var(--pd-text)',
                    borderRadius: 'var(--pd-radius)',
                  }}
                >
                  Dashboard
                </Link>
                <Link
                  href={design.availability}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold pd-press"
                  style={{
                    background: 'var(--pd-surface-muted)',
                    color: 'var(--pd-text)',
                    borderRadius: 'var(--pd-radius)',
                  }}
                >
                  Disponibilità
                </Link>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center text-xs" style={{ color: 'var(--pd-muted)' }}>
          L&apos;app reale non è stata modificata. Rispondi con A, B o C (Fornace, Linea o
          Brace).
        </p>
      </div>
    </div>
  )
}
