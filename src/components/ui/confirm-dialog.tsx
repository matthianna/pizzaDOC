'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  isDangerous?: boolean
  isLoading?: boolean
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

/** Lightweight yes/no confirm — use instead of window.confirm in the PWA. */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)

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

  const loading = busy || isLoading

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Confirm action failed:', error)
    } finally {
      setBusy(false)
    }
  }

  const content = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center box-border"
      style={{
        height: '100dvh',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <button
        type="button"
        aria-label="Chiudi"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => !loading && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--pd-surface)',
          border: '1px solid var(--pd-border)',
          boxShadow: 'var(--pd-shadow)',
          maxHeight:
            'min(90dvh, calc(100dvh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)))',
        }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={
                isDangerous
                  ? { backgroundColor: 'var(--pd-danger-soft)', color: 'var(--pd-danger)' }
                  : { backgroundColor: 'var(--pd-accent-soft)', color: 'var(--pd-accent)' }
              }
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="confirm-dialog-title"
                className="text-lg font-bold"
                style={{ color: 'var(--pd-text)' }}
              >
                {title}
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--pd-muted)' }}>
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="p-2 rounded-lg disabled:opacity-50"
            style={{ color: 'var(--pd-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--pd-surface-muted)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDangerous ? 'danger' : 'primary'}
            onClick={handleConfirm}
            disabled={loading}
            isLoading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )

  if (typeof window !== 'undefined') {
    return createPortal(content, document.body)
  }
  return content
}
