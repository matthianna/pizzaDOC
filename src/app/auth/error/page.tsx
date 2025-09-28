'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <img
            src="/logo.png"
            alt="PizzaDOC Logo"
            className="mx-auto h-16 w-16 rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const nextEl = e.currentTarget.nextElementSibling as HTMLElement
              if (nextEl) nextEl.style.display = 'block'
            }}
          />
          <span className="text-4xl hidden">🍕</span>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Errore di Accesso
          </h2>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Si è verificato un errore
            </h3>
            
            <div className="mt-2">
              <p className="text-sm text-gray-600">
                {error === 'CredentialsSignin' && 'Credenziali non valide. Verifica username e password.'}
                {error === 'AccessDenied' && 'Accesso negato. Non hai i permessi necessari.'}
                {error === 'Configuration' && 'Errore di configurazione. Contatta l\'amministratore.'}
                {!error && 'Si è verificato un errore durante l\'accesso.'}
              </p>
            </div>

            <div className="mt-6">
              <Link
                href="/auth/signin"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                Torna al Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}