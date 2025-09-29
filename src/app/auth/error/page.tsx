'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, Pizza, ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'CredentialsSignin':
        return {
          title: 'Credenziali non valide',
          message: 'Nome utente o password non corretti. Verifica i tuoi dati e riprova.'
        }
      case 'AccessDenied':
        return {
          title: 'Accesso negato',
          message: 'Il tuo account potrebbe essere disattivato. Contatta un amministratore.'
        }
      case 'Configuration':
        return {
          title: 'Errore di configurazione',
          message: 'Si è verificato un problema con la configurazione del sistema.'
        }
      default:
        return {
          title: 'Errore di autenticazione',
          message: 'Si è verificato un errore durante il login. Riprova più tardi.'
        }
    }
  }

  const errorInfo = getErrorMessage(error)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-100 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="flex items-center space-x-2 text-orange-600">
              <Pizza className="h-12 w-12" />
              <h1 className="text-3xl font-bold">PizzaDOC</h1>
            </div>
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-gray-900">
            Ops! Qualcosa è andato storto
          </h2>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {errorInfo.title}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {errorInfo.message}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-gray-50 rounded-md p-3">
              <p className="text-xs text-gray-500">
                Codice errore: <code className="font-mono bg-gray-200 px-1 rounded">{error}</code>
              </p>
            </div>
          )}

          <div className="pt-4">
            <Link
              href="/auth/signin"
              className="w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Torna al login
            </Link>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-gray-500">
              Se il problema persiste, contatta un amministratore
            </p>
          </div>
        </div>

        {/* Troubleshooting Tips */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            Suggerimenti
          </h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-orange-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              <span>Verifica che il nome utente sia scritto correttamente (maiuscole/minuscole)</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-orange-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              <span>Se è il tuo primo accesso, la password è il tuo nome utente in minuscolo</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-orange-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              <span>Assicurati che il tuo account sia attivo</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
