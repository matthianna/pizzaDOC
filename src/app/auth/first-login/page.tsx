'use client'

import { useState } from 'react'
import { useSession, signOut, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function FirstLoginPage() {
  const { data: session, update } = useSession()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { showToast, ToastContainer } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('Le password non coincidono')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri')
      setIsLoading(false)
      return
    }

    try {
      console.log('Attempting to change password for user:', session?.user.id)
      
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Importante: include i cookie di sessione
        body: JSON.stringify({
          userId: session?.user.id,
          newPassword: password
        })
      })
      
      console.log('API Response status:', response.status)

      const data = await response.json()

      if (response.ok) {
        console.log('Password changed successfully:', data)
        
        // Show success message
        showToast('Password cambiata con successo! Effettuo il re-login...', 'success')
        
        // Get username for re-login
        const username = session?.user.username
        
        if (username) {
          // Wait a bit, then sign out and sign in with new password
          setTimeout(async () => {
            console.log('Re-login with new password...')
            
            // Sign out without redirect
            await signOut({ redirect: false })
            
            // Sign in with new credentials
            const result = await signIn('credentials', {
              username: username,
              password: password,
              redirect: false
            })
            
            if (result?.ok) {
              console.log('Re-login successful, redirecting to dashboard...')
              router.push('/dashboard')
              router.refresh()
            } else {
              console.error('Re-login failed:', result?.error)
              showToast('Errore durante il re-login. Effettua il login manualmente.', 'error')
              router.push('/auth/signin')
            }
          }, 1500)
        } else {
          // Fallback: just redirect to login
          setTimeout(() => {
            router.push('/auth/signin')
          }, 1500)
        }
      } else {
        console.error('Password change failed:', data)
        setError(data.error || 'Errore durante il cambio password')
        showToast(data.error || 'Errore durante il cambio password', 'error')
      }
    } catch (error) {
      console.error('Network error during password change:', error)
      setError('Errore di connessione. Riprova.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-6 bg-orange-500 rounded-full">
            <img
              src="/logo.png"
              alt="PizzaDOC Logo"
              className="w-20 h-20 rounded-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const nextEl = e.currentTarget.nextElementSibling as HTMLElement
                if (nextEl) nextEl.style.display = 'flex'
              }}
            />
            <span className="text-white font-bold text-2xl hidden items-center justify-center">🍕</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Primo Accesso</h1>
          <p className="text-gray-600 text-sm">
            Ciao <span className="font-semibold text-orange-600">{session?.user.username}</span>!<br />
            Imposta una nuova password
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Nuova password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Almeno 6 caratteri"
                  className={`w-full px-3 py-2 pr-10 border rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-500 ${
                    password.length > 0 
                      ? password.length >= 6 
                        ? 'border-green-300' 
                        : 'border-red-300'
                      : 'border-gray-300'
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {password.length > 0 && password.length < 6 && (
                <p className="mt-1 text-xs text-red-600">
                  Troppo corta ({password.length}/6)
                </p>
              )}
              {password.length >= 6 && (
                <p className="mt-1 text-xs text-green-600">
                  ✓ Password valida
                </p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Conferma password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ripeti la password"
                  className={`w-full px-3 py-2 pr-10 border rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-500 ${
                    confirmPassword.length > 0 
                      ? password === confirmPassword 
                        ? 'border-green-300' 
                        : 'border-red-300'
                      : 'border-gray-300'
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-600">
                  ✗ Le password non coincidono
                </p>
              )}
              {confirmPassword.length > 0 && password === confirmPassword && password.length >= 6 && (
                <p className="mt-1 text-xs text-green-600">
                  ✓ Password confermata
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || password.length < 6 || password !== confirmPassword}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium py-2.5 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Aggiornamento...
                </div>
              ) : (
                'Cambia Password'
              )}
            </button>
          </form>

          {/* Security note */}
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
            <p className="text-xs text-orange-700">
              <strong>Nota:</strong> Dopo il cambio, accederai automaticamente al sistema.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            © 2025 PizzaDOC
          </p>
        </div>
      </div>
      
      <ToastContainer />
    </div>
  )
}
