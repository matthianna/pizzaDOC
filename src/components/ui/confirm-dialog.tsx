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
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
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
        className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                isDangerous ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id="confirm-dialog-title" className="text-lg font-bold text-gray-900">
                {title}
              </h2>
              <p className="mt-1 text-sm text-gray-600">{description}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50"
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
