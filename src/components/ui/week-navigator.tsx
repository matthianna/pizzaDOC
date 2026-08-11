'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type WeekNavigatorProps = {
  label: string
  onPrev: () => void
  onNext: () => void
  onToday?: () => void
  disabled?: boolean
  className?: string
  /** Optional secondary line under the week label */
  hint?: string
}

export function WeekNavigator({
  label,
  onPrev,
  onNext,
  onToday,
  disabled,
  className,
  hint,
}: WeekNavigatorProps) {
  return (
    <div
      className={cn('flex items-center justify-between gap-3 px-3 py-3', className)}
      style={{
        background: 'var(--pd-surface)',
        border: '1px solid var(--pd-border)',
        borderRadius: 'var(--pd-radius-lg)',
        boxShadow: 'var(--pd-shadow)',
      }}
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={disabled}
        aria-label="Settimana precedente"
        className="p-2.5 pd-press disabled:opacity-40"
        style={{
          background: 'var(--pd-surface-muted)',
          borderRadius: 'var(--pd-radius)',
          color: 'var(--pd-text)',
        }}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="min-w-0 text-center flex-1">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--pd-text)' }}>
          {label}
        </p>
        {hint ? (
          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--pd-muted)' }}>
            {hint}
          </p>
        ) : null}
        {onToday ? (
          <button
            type="button"
            onClick={onToday}
            disabled={disabled}
            className="mt-1 text-[11px] font-semibold disabled:opacity-40"
            style={{ color: 'var(--pd-accent)' }}
          >
            Vai a oggi
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        aria-label="Settimana successiva"
        className="p-2.5 pd-press disabled:opacity-40"
        style={{
          background: 'var(--pd-surface-muted)',
          borderRadius: 'var(--pd-radius)',
          color: 'var(--pd-text)',
        }}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}
