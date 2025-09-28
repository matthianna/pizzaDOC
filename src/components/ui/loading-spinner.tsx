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
    ? 'min-h-screen flex items-center justify-center bg-gray-50'
    : 'flex items-center justify-center py-8'

  return (
    <div className={containerClasses}>
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <Pizza className={`${sizeClasses[size]} text-orange-600 animate-pulse`} />
        </div>
        {text && (
          <p className="text-gray-600 text-sm animate-pulse">{text}</p>
        )}
      </div>
    </div>
  )
}
