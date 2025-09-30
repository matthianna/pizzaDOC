'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function SignInPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { showToast, ToastContainer } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        username: username.trim(),
        password,
        redirect: false
      })

      if (result?.error) {
        if (result.error === 'CredentialsSignin') {
          setError('Nome utente o password non corretti')
        } else {
          setError('Errore durante il login. Riprova.')
        }
      } else {
        console.log('Login successful, checking session...')
        // Force refresh to get updated session
        setTimeout(async () => {
          try {
            const session = await getSession()
            console.log('Session after login:', session?.user)
            
            if (session?.user.isFirstLogin) {
              console.log('First login detected, redirecting to change password')
              router.push('/auth/first-login')
            } else {
              console.log('Regular login, redirecting to dashboard')
              router.push('/dashboard')
            }
            
            // Force page refresh to ensure middleware recognizes session
            window.location.reload()
          } catch (error) {
            console.error('Error getting session:', error)
            // Fallback: let middleware handle redirect
            router.push('/dashboard')
          }
        }, 500)
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Errore durante il login. Riprova.')
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">PizzaDOC</h1>
          <p className="text-gray-600 text-sm">Accedi al tuo account</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Nome utente
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Il tuo nome utente"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-500"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="La tua password"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-500"
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
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium py-2.5 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Accesso...
                </div>
              ) : (
                'Accedi'
              )}
            </button>
          </form>
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
