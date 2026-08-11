'use client'

import Link from 'next/link'
import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type QuickAction = {
  label: string
  href?: string
  onClick?: () => void
  icon?: ComponentType<{ className?: string }>
  disabled?: boolean
}

type QuickActionPillsProps = {
  items: QuickAction[]
  className?: string
}

export function QuickActionPills({ items, className }: QuickActionPillsProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {items.map((item) => {
        const Icon = item.icon
        const content: ReactNode = (
          <>
            {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
            {item.label}
          </>
        )
        const style = {
          background: 'var(--pd-accent-soft)',
          color: 'var(--pd-accent)',
          borderRadius: 'var(--pd-radius-pill)',
        } as const
        const classNameBtn =
          'inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold pd-press disabled:opacity-50'

        if (item.href && !item.disabled) {
          return (
            <Link key={item.label} href={item.href} className={classNameBtn} style={style}>
              {content}
            </Link>
          )
        }

        return (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            onClick={item.onClick}
            className={classNameBtn}
            style={style}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
