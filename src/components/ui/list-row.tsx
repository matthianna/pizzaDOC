'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ListRowProps = {
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  highlight?: boolean
  onClick?: () => void
  className?: string
  as?: 'div' | 'button' | 'li'
}

export function ListRow({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  highlight,
  onClick,
  className,
  as = 'div',
}: ListRowProps) {
  // Never nest buttons: if trailing actions exist, force a div row.
  const resolvedAs = as === 'button' && trailing ? 'div' : as
  const interactive = Boolean(onClick) || resolvedAs === 'button'
  const style = {
    background: highlight ? 'var(--pd-accent-soft)' : 'transparent',
    borderBottom: '1px solid var(--pd-border)',
  } as const
  const rowClass = cn(
    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
    interactive && 'hover:opacity-95 active:scale-[0.995]',
    interactive && resolvedAs !== 'button' && 'cursor-pointer',
    className
  )

  const body = (
    <>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--pd-text)' }}>
            {title}
          </p>
          {meta ? (
            <span className="text-xs shrink-0 tabular-nums" style={{ color: 'var(--pd-muted)' }}>
              {meta}
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--pd-muted)' }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </>
  )

  if (resolvedAs === 'button') {
    return (
      <button type="button" data-list-row onClick={onClick} className={rowClass} style={style}>
        {body}
      </button>
    )
  }

  if (resolvedAs === 'li') {
    return (
      <li data-list-row className={rowClass} style={style} onClick={onClick}>
        {body}
      </li>
    )
  }

  return (
    <div
      data-list-row
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={rowClass}
      style={style}
      onClick={onClick}
    >
      {body}
    </div>
  )
}

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn('py-8 px-5 text-center', className)}>
      {icon ? <div className="mb-3 flex justify-center opacity-60">{icon}</div> : null}
      <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
        {title}
      </p>
      {description ? (
        <p className="mt-1 text-sm" style={{ color: 'var(--pd-muted)' }}>
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
