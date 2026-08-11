'use client'

import { Pizza } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ 
  size = 'md', 
  text = 'Caricamento...', 
  fullScreen = false 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12'
  }

  const containerClasses = fullScreen 
    ? 'min-h-screen flex items-center justify-center'
    : 'flex items-center justify-center py-8'

  return (
    <div
      className={containerClasses}
      style={fullScreen ? { backgroundColor: 'var(--pd-bg)' } : undefined}
    >
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <Pizza
            className={`${sizeClasses[size]} animate-pulse`}
            style={{ color: 'var(--pd-accent)' }}
          />
        </div>
        {text && (
          <p
            className="text-sm animate-pulse"
            style={{ color: 'var(--pd-muted)' }}
          >
            {text}
          </p>
        )}
      </div>
    </div>
  )
}
