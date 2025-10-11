'use client'

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-lg w-full transform transition-all">
        {/* Header */}
        <div className={`px-6 py-4 border-b rounded-t-xl ${
          isDangerous 
            ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-100'
            : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-100'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isDangerous ? 'bg-red-100' : 'bg-blue-100'
              }`}>
                <AlertTriangle className={`h-5 w-5 ${
                  isDangerous ? 'text-red-600' : 'text-blue-600'
                }`} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                <p className={`text-sm ${
                  isDangerous ? 'text-red-600' : 'text-blue-600'
                }`}>
                  Richiesta conferma
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isDangerous
                  ? 'bg-red-100 hover:bg-red-200'
                  : 'bg-blue-100 hover:bg-blue-200'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <X className={`h-4 w-4 ${
                isDangerous ? 'text-red-600' : 'text-blue-600'
              }`} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Description */}
          <div className={`border rounded-lg p-4 ${
            isDangerous
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <p className={`text-sm ${
              isDangerous ? 'text-red-800' : 'text-blue-800'
            }`}>
              {description}
            </p>
          </div>

          {/* Metadata */}
          {metadata && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              {metadata}
            </div>
          )}

          {/* Confirmation Input */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-800">
              Per confermare, digita: <span className="font-mono text-red-600">{confirmPhrase}</span>
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              placeholder={`Digita "${confirmPhrase}" per confermare`}
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              autoComplete="off"
              autoFocus
            />
            {inputValue && inputValue !== confirmPhrase && (
              <p className="text-xs text-red-600">
                ⚠️ Il testo non corrisponde. Controlla le maiuscole.
              </p>
            )}
          </div>

          {/* Warning */}
          {isDangerous && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">Attenzione!</p>
                  <p className="text-amber-700">
                    Questa azione non può essere annullata. Assicurati di voler procedere.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-xl">
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annulla
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isConfirmEnabled}
              className={`px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 ${
                isDangerous
                  ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>In corso...</span>
                </>
              ) : (
                <span>{confirmButtonText}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

