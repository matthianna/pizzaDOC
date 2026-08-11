'use client'

import type { ReactNode } from 'react'

type StaffPageHeaderProps = {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function StaffPageHeader({ title, subtitle, action }: StaffPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div>
        <h1
          className="pd-display text-2xl sm:text-3xl font-semibold tracking-tight"
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
      {action}
    </div>
  )
}
