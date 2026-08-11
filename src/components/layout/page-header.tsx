'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
  /** Admin tools can use a slightly tighter title scale */
  dense?: boolean
}

/** Open Fornace page title — no card wrapper. */
export function PageHeader({ title, subtitle, action, className, dense }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-start justify-between gap-4',
        className
      )}
    >
      <div className="min-w-0">
        <h1
          className={cn(
            'pd-display font-semibold tracking-tight',
            dense ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
          )}
          style={{ color: 'var(--pd-text)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: 'var(--pd-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div> : null}
    </div>
  )
}
