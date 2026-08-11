'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SectionBlockProps = {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  /** Wrap children in a soft surface card */
  card?: boolean
}

export function SectionBlock({
  title,
  subtitle,
  action,
  children,
  className,
  card = false,
}: SectionBlockProps) {
  return (
    <section className={cn('space-y-3', className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {card ? (
        <div
          className="overflow-hidden pd-list"
          style={{
            background: 'var(--pd-surface)',
            border: '1px solid var(--pd-border)',
            borderRadius: 'var(--pd-radius-lg)',
            boxShadow: 'var(--pd-shadow)',
          }}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  )
}
