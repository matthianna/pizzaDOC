'use client'

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
  headerIcon?: React.ReactNode
  /** Portal root stacking; default keeps overlays above most in-app UI (e.g. bottom nav). */
  zIndex?: number
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
  className,
  headerIcon,
  zIndex = 99999,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const getMaxWidth = () => {
    switch (maxWidth) {
      case 'sm':
        return 448
      case 'md':
        return 672
      case 'lg':
        return 896
      case 'xl':
        return 1152
      case '2xl':
        return 1400
      default:
        return 672
    }
  }

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pd-modal-title"
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
        zIndex,
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className={className}
        style={{
          position: 'relative',
          backgroundColor: 'var(--pd-surface)',
          borderRadius: 'var(--pd-radius-xl)',
          boxShadow: 'var(--pd-shadow)',
          border: '1px solid var(--pd-border)',
          width: '100%',
          maxWidth: getMaxWidth(),
          maxHeight: 'min(90dvh, calc(100dvh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.25rem 1rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexShrink: 0,
            borderBottom: '1px solid var(--pd-border)',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: 1, minWidth: 0 }}>
            {headerIcon && (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--pd-accent)',
                  borderRadius: 'var(--pd-radius)',
                  color: 'var(--pd-accent-fg)',
                  flexShrink: 0,
                }}
              >
                {headerIcon}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2
                id="pd-modal-title"
                className="pd-display"
                style={{
                  fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
                  fontWeight: 600,
                  color: 'var(--pd-text)',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                {title}
              </h2>
              {subtitle && (
                <p
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'var(--pd-muted)',
                    margin: '0.35rem 0 0',
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            style={{
              padding: '0.625rem',
              backgroundColor: 'var(--pd-surface-muted)',
              border: 'none',
              borderRadius: 'var(--pd-radius)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X style={{ width: 20, height: 20, color: 'var(--pd-muted)' }} />
          </button>
        </div>

        <div
          style={{
            padding: '1.25rem',
            overflowY: 'auto',
            flex: 1,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )

  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body)
  }

  return modalContent
}
