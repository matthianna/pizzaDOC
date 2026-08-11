'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    children,
    disabled,
    ...props 
  }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
    
    const variants = {
      primary: "bg-[var(--pd-accent)] text-[var(--pd-accent-fg)] hover:bg-[var(--pd-accent-hover)] focus:ring-[var(--pd-accent)]",
      secondary: "bg-[var(--pd-surface-muted)] text-[var(--pd-text)] hover:opacity-90 focus:ring-[var(--pd-muted)]",
      outline: "border border-[var(--pd-border-strong)] bg-[var(--pd-surface)] text-[var(--pd-text)] hover:bg-[var(--pd-surface-muted)] focus:ring-[var(--pd-accent)]",
      ghost: "text-[var(--pd-text)] hover:bg-[var(--pd-surface-muted)] focus:ring-[var(--pd-muted)]",
      danger: "bg-[var(--pd-danger)] text-[var(--pd-accent-fg)] hover:opacity-90 focus:ring-[var(--pd-danger)]"
    }
    
    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base"
    }

    return (
      <button
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || isLoading}
        ref={ref}
        {...props}
      >
        {isLoading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
        ) : leftIcon ? (
          <div className="mr-2 h-4 w-4">{leftIcon}</div>
        ) : null}
        
        {children}
        
        {rightIcon && !isLoading && (
          <div className="ml-2 h-4 w-4">{rightIcon}</div>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
