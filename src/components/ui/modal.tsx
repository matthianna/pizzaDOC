'use client'

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  zIndex = 99999
}: ModalProps) {
  // Lock scroll when modal is open
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
      case 'sm': return 448
      case 'md': return 672
      case 'lg': return 896
      case 'xl': return 1152
      case '2xl': return 1400
      default: return 672
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
        zIndex,
        padding: 16,
        boxSizing: 'border-box'
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
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

      {/* Modal Box */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          backgroundColor: '#ffffff',
          borderRadius: 48,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: getMaxWidth(),
          maxHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flex: 1, minWidth: 0 }}>
            {headerIcon && (
              <div
                style={{
                  padding: 16,
                  backgroundColor: '#ea580c',
                  borderRadius: 24,
                  color: 'white',
                  flexShrink: 0,
                  boxShadow: '0 10px 15px -3px rgba(234, 88, 12, 0.3)'
                }}
              >
                {headerIcon}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: '#111827',
                  margin: 0,
                  letterSpacing: '-0.025em'
                }}
              >
                {title}
              </h2>
              {subtitle && (
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginTop: 6,
                    margin: 0,
                    marginTop: 6
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 12,
              backgroundColor: '#f3f4f6',
              border: 'none',
              borderRadius: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginLeft: 16
            }}
          >
            <X style={{ width: 24, height: 24, color: '#6b7280' }} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div
          style={{
            padding: '24px 48px 32px 48px',
            overflowY: 'auto',
            flex: 1
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )

  // Use portal to render at document body level
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body)
  }

  return modalContent
}
