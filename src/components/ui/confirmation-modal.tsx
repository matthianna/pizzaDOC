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
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: 16,
        boxSizing: 'border-box'
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
          backgroundColor: '#ffffff',
          borderRadius: 48,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: 672,
          maxHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '32px 48px 24px 48px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexShrink: 0,
            borderBottom: '1px solid #f3f4f6'
          }}
        >
          <h2
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: '#111827',
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
              backgroundColor: '#f3f4f6',
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
            <X style={{ width: 24, height: 24, color: '#6b7280' }} />
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
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-5 rounded-2xl border border-purple-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-200">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-purple-600 font-medium leading-snug">
                    {description}
                  </p>
                </div>
              </div>

              {metadata && (
                <div className="bg-white/60 rounded-xl p-4 border border-purple-100/80 text-left text-sm text-purple-900 space-y-1">
                  {metadata}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                Digita <span className="text-purple-600">{confirmPhrase}</span> per confermare
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                placeholder="Conferma qui..."
                className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-gray-900 bg-gray-50 font-bold text-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-all placeholder-gray-300"
                autoComplete="off"
                autoFocus
              />
            </div>

            {isDangerous && (
              <p className="text-xs text-red-600 font-medium bg-red-50 px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Azione irreversibile: verifica i dati prima di procedere.
              </p>
            )}
          </div>
        </div>

        <div
          className="flex justify-end gap-3 pt-4 border-t border-gray-100 px-12 pb-8"
          style={{ flexShrink: 0 }}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-6 py-3 text-xs font-black text-gray-600 uppercase tracking-widest hover:bg-gray-100 rounded-xl transition-all disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmEnabled}
            className="px-8 py-3 bg-purple-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center gap-2 min-w-[10rem] justify-center"
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
