'use client'

import React, { useEffect } from 'react'
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
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
  className,
  headerIcon
}: ModalProps) {
  // Lock scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className={cn(
        "relative bg-white w-full rounded-[2.5rem] shadow-2xl border border-white/50 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500",
        maxWidthClasses[maxWidth],
        className
      )}>
        {/* Header Visual Layer */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-gray-50 to-white -z-10" />
        
        {/* Modal Header */}
        <div className="px-8 pt-8 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-4">
            {headerIcon && (
              <div className="p-3 bg-orange-600 rounded-2xl shadow-lg shadow-orange-100 text-white">
                {headerIcon}
              </div>
            )}
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h2>
              {subtitle && <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl transition-all active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-8 pb-8 overflow-y-auto max-h-[calc(90vh-140px)] scrollbar-hide">
          {children}
        </div>
      </div>
    </div>
  )
}
