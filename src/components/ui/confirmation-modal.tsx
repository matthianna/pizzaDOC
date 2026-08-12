'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X, RefreshCw } from 'lucide-react'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  confirmPhrase: string
  confirmButtonText?: string
  isDangerous?: boolean
  metadata?: React.ReactNode
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmPhrase,
  confirmButtonText = 'Conferma',
  isDangerous = true,
  metadata,
}: ConfirmationModalProps) {
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)
    }
  }, [isOpen])

  if (!isOpen) return null

  const isConfirmEnabled = inputValue === confirmPhrase && !isLoading

  const handleConfirm = async () => {
    if (!isConfirmEnabled) return

    setIsLoading(true)
    setInputValue('')
    // Dismiss immediately so long actions (e.g. schedule generation animation) are not covered
    onClose()
    try {
      await onConfirm()
    } catch (error) {
      console.error('Confirmation action failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setInputValue('')
      onClose()
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div
        onClick={handleClose}
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg flex flex-col overflow-hidden"
        style={{
          backgroundColor: 'var(--pd-surface)',
          borderRadius: 'var(--pd-radius-lg)',
          boxShadow: 'var(--pd-shadow)',
          border: '1px solid var(--pd-border)',
          maxHeight:
            'min(90dvh, calc(100dvh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)))',
        }}
      >
        <div
          className="flex items-start justify-between gap-3 px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--pd-border)' }}
        >
          <div className="min-w-0">
            <h2 className="pd-display text-xl font-semibold tracking-tight" style={{ color: 'var(--pd-text)' }}>
              {title}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--pd-muted)' }}>
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 shrink-0 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--pd-surface-muted)',
              borderRadius: 'var(--pd-radius)',
            }}
          >
            <X className="h-5 w-5" style={{ color: 'var(--pd-muted)' }} />
          </button>
        </div>

        <div className="px-5 py-5 overflow-y-auto flex-1 space-y-5">
          {metadata ? (
            <div
              className="rounded-[var(--pd-radius)] p-4 text-sm space-y-1"
              style={{
                backgroundColor: 'var(--pd-surface-muted)',
                border: '1px solid var(--pd-border)',
                color: 'var(--pd-text)',
              }}
            >
              {metadata}
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--pd-muted)' }}>
              Digita <span style={{ color: 'var(--pd-accent)' }}>{confirmPhrase}</span> per confermare
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              placeholder="Conferma qui…"
              className="w-full border px-4 py-2.5 text-sm font-semibold text-center focus:outline-none focus:ring-2"
              style={{
                borderColor: 'var(--pd-border)',
                borderRadius: 'var(--pd-radius)',
                backgroundColor: 'var(--pd-surface-muted)',
                color: 'var(--pd-text)',
              }}
              autoComplete="off"
              autoFocus
            />
          </div>

          {isDangerous ? (
            <p
              className="text-xs font-medium px-3 py-2.5 flex items-center gap-2"
              style={{
                color: 'var(--pd-danger)',
                backgroundColor: 'var(--pd-danger-soft)',
                borderRadius: 'var(--pd-radius)',
              }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Azione irreversibile: verifica i dati prima di procedere.
            </p>
          ) : null}
        </div>

        <div
          className="flex justify-end gap-2 px-5 py-4 shrink-0"
          style={{ borderTop: '1px solid var(--pd-border)' }}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            style={{
              color: 'var(--pd-muted)',
              borderRadius: 'var(--pd-radius)',
              background: 'var(--pd-surface-muted)',
            }}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmEnabled}
            className="px-5 py-2.5 text-sm pd-btn-primary disabled:opacity-50 inline-flex items-center gap-2 min-w-[8rem] justify-center"
          >
            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body)
  }

  return modalContent
}
