'use client'

import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type PreviewButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  children: ReactNode
}

export function PreviewButton({
  variant = 'primary',
  className,
  children,
  ...props
}: PreviewButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors pd-press disabled:opacity-50',
        variant === 'primary' && 'pd-btn-primary',
        className
      )}
      style={
        variant === 'secondary'
          ? {
              background: 'var(--pd-surface)',
              color: 'var(--pd-text)',
              border: '1px solid var(--pd-border-strong)',
              borderRadius: 'var(--pd-radius)',
            }
          : variant === 'ghost'
            ? {
                background: 'transparent',
                color: 'var(--pd-muted)',
                borderRadius: 'var(--pd-radius)',
              }
            : undefined
      }
      {...props}
    >
      {children}
    </button>
  )
}
