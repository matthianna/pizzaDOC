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
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    '2xl': 'max-w-[90vw]',
  }

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-center p-4 sm:p-12 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className={cn(
        "relative bg-white w-full rounded-[3rem] shadow-2xl border border-white/50 animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 my-auto flex flex-col",
        maxWidthClasses[maxWidth],
        className
      )}>
        {/* Header Visual Layer */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-br from-gray-50 to-white rounded-t-[3rem] -z-10" />
        
        {/* Modal Header */}
        <div className="px-12 pt-12 pb-8 flex items-start justify-between relative z-10">
          <div className="flex items-center gap-6">
            {headerIcon && (
              <div className="p-4 bg-orange-600 rounded-[1.5rem] shadow-xl shadow-orange-100 text-white">
                {headerIcon}
              </div>
            )}
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">{title}</h2>
              {subtitle && <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mt-1.5 opacity-70">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-gray-100/80 hover:bg-gray-200 text-gray-500 rounded-2xl transition-all active:scale-90 backdrop-blur-sm"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-12 pb-12 overflow-y-auto max-h-[calc(95vh-180px)] scrollbar-thin scrollbar-thumb-gray-200 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  )
}
