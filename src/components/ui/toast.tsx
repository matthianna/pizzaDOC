'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Info, AlertCircle, X } from 'lucide-react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info' | 'warning'
  duration?: number
  onClose?: () => void
}

export function Toast({ message, type = 'info', duration = 4000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => {
        onClose?.()
      }, 300)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5" style={{ color: 'var(--pd-success)' }} />
      case 'error':
        return <XCircle className="h-5 w-5" style={{ color: 'var(--pd-danger)' }} />
      case 'warning':
        return <AlertCircle className="h-5 w-5" style={{ color: 'var(--pd-warning)' }} />
      default:
        return <Info className="h-5 w-5" style={{ color: 'var(--pd-accent)' }} />
    }
  }

  const getStyles = (): React.CSSProperties => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: 'var(--pd-success-soft)',
          borderColor: 'var(--pd-success)',
          color: 'var(--pd-text)',
        }
      case 'error':
        return {
          backgroundColor: 'var(--pd-danger-soft)',
          borderColor: 'var(--pd-danger)',
          color: 'var(--pd-text)',
        }
      case 'warning':
        return {
          backgroundColor: 'var(--pd-warning-soft)',
          borderColor: 'var(--pd-warning)',
          color: 'var(--pd-text)',
        }
      default:
        return {
          backgroundColor: 'var(--pd-accent-soft)',
          borderColor: 'var(--pd-accent)',
          color: 'var(--pd-text)',
        }
    }
  }

  if (!isVisible) return null

  return (
    <div className={`fixed top-4 right-4 z-50 transform transition-all duration-300 ${
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      <div
        className="flex items-center p-4 rounded-lg border shadow-lg max-w-sm"
        style={getStyles()}
      >
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={() => {
            setIsVisible(false)
            setTimeout(() => onClose?.(), 300)
          }}
          className="ml-4 flex-shrink-0 rounded-md p-1 transition-colors"
          style={{ color: 'var(--pd-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--pd-surface-muted)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastProps['type'] }>>([])

  const showToast = (message: string, type: ToastProps['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  const ToastContainer = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )

  return { showToast, ToastContainer }
}
