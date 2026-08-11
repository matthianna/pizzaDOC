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
  metadata
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
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Confirmation action failed:', error)
    } finally {
      setIsLoading(false)
      setInputValue('')
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          backgroundColor: 'var(--pd-surface)',
          borderRadius: 48,
          boxShadow: 'var(--pd-shadow)',
          border: '1px solid var(--pd-border)',
          width: '100%',
          maxWidth: 672,
          maxHeight:
            'min(90dvh, calc(100dvh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '32px 48px 24px 48px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexShrink: 0,
            borderBottom: '1px solid var(--pd-border)'
          }}
        >
          <h2
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: 'var(--pd-text)',
              margin: 0,
              letterSpacing: '-0.025em',
              paddingRight: 16
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            style={{
              padding: 12,
              backgroundColor: 'var(--pd-surface-muted)',
              border: 'none',
              borderRadius: 16,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              opacity: isLoading ? 0.6 : 1
            }}
          >
            <X style={{ width: 24, height: 24, color: 'var(--pd-muted)' }} />
          </button>
        </div>

        <div
          style={{
            padding: '24px 48px 32px 48px',
            overflowY: 'auto',
            flex: 1
          }}
        >
          <div className="space-y-6">
            <div
              className="p-5 rounded-2xl"
              style={{
                background: 'var(--pd-accent-soft)',
                border: '1px solid var(--pd-border)',
              }}
            >
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{
                    backgroundColor: 'var(--pd-accent)',
                    color: 'var(--pd-accent-fg)',
                    boxShadow: '0 8px 24px -8px color-mix(in srgb, var(--pd-accent) 55%, transparent)',
                  }}
                >
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <p
                    className="text-xs font-medium leading-snug"
                    style={{ color: 'var(--pd-text)' }}
                  >
                    {description}
                  </p>
                </div>
              </div>

              {metadata && (
                <div
                  className="rounded-xl p-4 text-left text-sm space-y-1"
                  style={{
                    backgroundColor: 'var(--pd-surface)',
                    border: '1px solid var(--pd-border)',
                    color: 'var(--pd-text)',
                  }}
                >
                  {metadata}
                </div>
              )}
            </div>

            <div>
              <label
                className="block text-xs font-black uppercase tracking-widest mb-3"
                style={{ color: 'var(--pd-muted)' }}
              >
                Digita <span style={{ color: 'var(--pd-accent)' }}>{confirmPhrase}</span> per confermare
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                placeholder="Conferma qui..."
                className="w-full border-2 rounded-2xl px-5 py-4 font-bold text-center focus:outline-none focus:ring-2 transition-all"
                style={{
                  borderColor: 'var(--pd-border-strong)',
                  backgroundColor: 'var(--pd-surface-muted)',
                  color: 'var(--pd-text)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--pd-accent)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px var(--pd-accent-soft)'
                  e.currentTarget.style.backgroundColor = 'var(--pd-surface)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--pd-border-strong)'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.backgroundColor = 'var(--pd-surface-muted)'
                }}
                autoComplete="off"
                autoFocus
              />
            </div>

            {isDangerous && (
              <p
                className="text-xs font-medium px-4 py-3 rounded-xl flex items-center gap-2"
                style={{
                  color: 'var(--pd-danger)',
                  backgroundColor: 'var(--pd-danger-soft)',
                }}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Azione irreversibile: verifica i dati prima di procedere.
              </p>
            )}
          </div>
        </div>

        <div
          className="flex justify-end gap-3 pt-4 px-12 pb-8"
          style={{
            flexShrink: 0,
            borderTop: '1px solid var(--pd-border)',
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
            style={{ color: 'var(--pd-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--pd-surface-muted)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmEnabled}
            className="px-8 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 min-w-[10rem] justify-center"
            style={{
              backgroundColor: 'var(--pd-accent)',
              color: 'var(--pd-accent-fg)',
              boxShadow: '0 8px 24px -8px color-mix(in srgb, var(--pd-accent) 55%, transparent)',
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = 'var(--pd-accent-hover)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--pd-accent)'
            }}
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
