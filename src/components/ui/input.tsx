'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
  multiline?: boolean
  rows?: number
}

export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  ({ 
    className, 
    type = 'text',
    label,
    error,
    helperText,
    startIcon,
    endIcon,
    multiline = false,
    rows = 3,
    ...props 
  }, ref) => {
    const baseClasses = cn(
      "block w-full rounded-md border shadow-sm text-[var(--pd-text)] placeholder:text-[var(--pd-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)] focus:border-[var(--pd-accent)] sm:text-sm",
      error ? "border-[var(--pd-danger)]" : "border-[var(--pd-border-strong)]",
      startIcon && !multiline ? "pl-10" : "pl-3",
      endIcon && !multiline ? "pr-10" : "pr-3",
      !multiline ? "py-2" : "py-2",
      props.disabled ? "bg-[var(--pd-surface-muted)] text-[var(--pd-muted)] cursor-not-allowed" : "bg-[var(--pd-surface)]",
      className
    )

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[var(--pd-text)] mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {startIcon && !multiline && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <div className="h-5 w-5 text-[var(--pd-muted)]">
                {startIcon}
              </div>
            </div>
          )}
          {multiline ? (
            <textarea
              rows={rows}
              className={baseClasses}
              ref={ref as any}
              {...(props as any)}
            />
          ) : (
            <input
              type={type}
              className={baseClasses}
              ref={ref as any}
              {...props}
            />
          )}
          {endIcon && !multiline && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <div className="h-5 w-5 text-[var(--pd-muted)]">
                {endIcon}
              </div>
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-[var(--pd-danger)]">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-[var(--pd-muted)]">{helperText}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
