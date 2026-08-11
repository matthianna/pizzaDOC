'use client'

import Link from 'next/link'
import {
  Clock,
  CalendarDays,
  ArrowLeftRight,
  ChevronRight,
  Sun,
  Moon,
  Bike,
  ChefHat,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { PreviewShell } from '@/components/design-preview/preview-shell'
import { PreviewButton } from '@/components/design-preview/preview-button'
import { useDesignPreviewTheme } from '@/components/design-preview/theme-provider'

const TODAY_SHIFTS = {
  pranzo: [
    { name: 'Luca M.', role: 'Pizzaiolo', time: '11:30–15:00', icon: ChefHat },
    { name: 'Sara B.', role: 'Sala', time: '12:00–15:30', icon: Sun },
  ],
  cena: [
    { name: 'Matteo I.', role: 'Pizzaiolo', time: '18:00–23:30', icon: ChefHat, me: true },
    { name: 'Giulia R.', role: 'Sala', time: '18:30–23:00', icon: Moon },
    { name: 'Marco T.', role: 'Delivery', time: '19:00–23:00', icon: Bike },
  ],
}

export function DashboardView() {
  const { basePath } = useDesignPreviewTheme()

  const quick = [
    { href: `${basePath}/availability`, label: 'Disponibilità', icon: CalendarDays },
    { label: 'Le mie ore', icon: Clock },
    { label: 'Sostituzioni', icon: ArrowLeftRight },
  ]

  return (
    <PreviewShell title="Home" subtitle="Martedì 11 agosto">
      <div className="space-y-6 max-w-4xl">
        <section>
          <p className="text-sm font-medium" style={{ color: 'var(--pd-muted)' }}>
            Buonasera
          </p>
          <h2 className="pd-display text-2xl sm:text-3xl font-semibold tracking-tight mt-0.5">
            Matteo
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--pd-muted)' }}>
            Oggi hai turno a cena · 18:00–23:30 · Pizzaiolo
          </p>
        </section>

        <section
          className="grid grid-cols-3 gap-px overflow-hidden"
          style={{
            background: 'var(--pd-border)',
            border: '1px solid var(--pd-border)',
            borderRadius: 'var(--pd-radius-lg)',
          }}
        >
          {[
            { label: 'Turni settimana', value: '4' },
            { label: 'Ore mese', value: '62,5' },
            { label: 'In attesa', value: '1' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="px-3 py-4 text-center"
              style={{ background: 'var(--pd-surface)' }}
            >
              <p className="pd-display text-2xl font-semibold tabular-nums">{stat.value}</p>
              <p className="text-[11px] mt-1 font-medium" style={{ color: 'var(--pd-muted)' }}>
                {stat.label}
              </p>
            </div>
          ))}
        </section>

        <section>
          <h3
            className="text-xs font-semibold uppercase tracking-[0.14em] mb-3"
            style={{ color: 'var(--pd-muted)' }}
          >
            Azioni rapide
          </h3>
          <div className="flex flex-wrap gap-2">
            {quick.map((item) => {
              const Icon = item.icon
              const className =
                'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold pd-press'
              const style = {
                background: 'var(--pd-accent-soft)',
                color: 'var(--pd-accent)',
                borderRadius: 'var(--pd-radius-pill)',
              } as const

              if ('href' in item && item.href) {
                return (
                  <Link key={item.label} href={item.href} className={className} style={style}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              }

              return (
                <span key={item.label} className={className} style={style}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
              )
            })}
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="pd-display text-xl font-semibold">Turni di oggi</h3>
            <span className="text-xs font-medium" style={{ color: 'var(--pd-muted)' }}>
              5 in servizio
            </span>
          </div>

          <div className="space-y-5">
            <ShiftBlock title="Pranzo" time="11:30–15:30" people={TODAY_SHIFTS.pranzo} />
            <ShiftBlock title="Cena" time="18:00–23:30" people={TODAY_SHIFTS.cena} />
          </div>
        </section>

        <PreviewButton variant="secondary" className="w-full sm:w-auto">
          Vedi piano settimanale
          <ChevronRight className="h-4 w-4" />
        </PreviewButton>
      </div>
    </PreviewShell>
  )
}

function ShiftBlock({
  title,
  time,
  people,
}: {
  title: string
  time: string
  people: Array<{
    name: string
    role: string
    time: string
    icon: ComponentType<{ className?: string }>
    me?: boolean
  }>
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-sm font-semibold">{title}</p>
        <span className="text-xs" style={{ color: 'var(--pd-muted)' }}>
          {time}
        </span>
      </div>
      <ul
        className="overflow-hidden"
        style={{
          background: 'var(--pd-surface)',
          border: '1px solid var(--pd-border)',
          borderRadius: 'var(--pd-radius-lg)',
        }}
      >
        {people.map((person, index) => {
          const Icon = person.icon
          return (
            <li
              key={person.name}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                borderTop: index === 0 ? undefined : '1px solid var(--pd-border)',
                background: person.me ? 'var(--pd-accent-soft)' : undefined,
              }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full shrink-0"
                style={{
                  background: person.me ? 'var(--pd-accent)' : 'var(--pd-surface-muted)',
                  color: person.me ? 'var(--pd-accent-fg)' : 'var(--pd-muted)',
                }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold truncate">
                  {person.name}
                  {person.me && (
                    <span
                      className="ml-2 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: 'var(--pd-accent)' }}
                    >
                      Tu
                    </span>
                  )}
                </span>
                <span className="block text-xs" style={{ color: 'var(--pd-muted)' }}>
                  {person.role} · {person.time}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
