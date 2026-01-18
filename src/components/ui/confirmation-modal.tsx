'use client'

import { useState } from 'react'
import { AlertTriangle, X, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

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

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header Visual */}
        <div className={cn(
          "h-32 flex items-center justify-center relative overflow-hidden",
          isDangerous ? "bg-red-600" : "bg-orange-600"
        )}>
          {/* Decorative patterns */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
            </svg>
          </div>
          <div className="relative bg-white p-5 rounded-[2rem] shadow-xl">
            <AlertTriangle className={cn("h-10 w-10", isDangerous ? "text-red-600" : "text-orange-600")} />
          </div>
          
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="absolute top-6 right-6 p-2 bg-black/10 hover:bg-black/20 text-white rounded-full transition-all active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-10 text-center">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2">{title}</h2>
          <p className="text-gray-500 font-medium leading-relaxed mb-8">
            {description}
          </p>

          {metadata && (
            <div className="mb-8 bg-gray-50 rounded-2xl p-5 border border-gray-100 text-left">
              {metadata}
            </div>
          )}

          {/* Confirmation Input Section */}
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                Digita <span className={cn("text-sm", isDangerous ? "text-red-600" : "text-orange-600")}>{confirmPhrase}</span> per confermare
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                placeholder="Conferma qui..."
                className="w-full bg-gray-50 border-gray-200 border-2 rounded-2xl px-6 py-4 text-center text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all placeholder-gray-300"
                autoComplete="off"
                autoFocus
              />
            </div>

            {isDangerous && (
              <div className="flex items-center justify-center gap-2 text-red-500">
                <AlertTriangle className="h-3 w-3" />
                <span className="text-[9px] font-black uppercase tracking-wider italic">Azione irreversibile</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-8 py-4 text-sm font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 rounded-2xl transition-all"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmEnabled}
            className={cn(
              "flex-[2] px-8 py-4 text-sm font-black uppercase tracking-widest text-white rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2",
              isDangerous ? "bg-red-600 shadow-red-200" : "bg-orange-600 shadow-orange-200"
            )}
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              confirmButtonText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

