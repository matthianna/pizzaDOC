'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatStripItem = {
  label: string
  value: ReactNode
  href?: string
}

type StatStripProps = {
  items: StatStripItem[]
  className?: string
  columns?: 2 | 3 | 4
}

/** Single bordered metric strip (Fornace preview language). */
export function StatStrip({ items, className, columns }: StatStripProps) {
  const cols = columns ?? (items.length <= 2 ? 2 : items.length === 3 ? 3 : 4)

  return (
    <section
      className={cn('grid gap-px overflow-hidden', className)}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        background: 'var(--pd-border)',
        border: '1px solid var(--pd-border)',
        borderRadius: 'var(--pd-radius-lg)',
      }}
    >
      {items.map((item) => {
        const inner = (
          <>
            <p className="pd-display text-2xl font-semibold tabular-nums" style={{ color: 'var(--pd-text)' }}>
              {item.value}
            </p>
            <p className="text-[11px] mt-1 font-medium" style={{ color: 'var(--pd-muted)' }}>
              {item.label}
            </p>
          </>
        )

        if (item.href) {
          return (
            <Link
              key={item.label}
              href={item.href}
              className="px-3 py-4 text-center transition-opacity hover:opacity-90"
              style={{ background: 'var(--pd-surface)' }}
            >
              {inner}
            </Link>
          )
        }

        return (
          <div
            key={item.label}
            className="px-3 py-4 text-center"
            style={{ background: 'var(--pd-surface)' }}
          >
            {inner}
          </div>
        )
      })}
    </section>
  )
}
