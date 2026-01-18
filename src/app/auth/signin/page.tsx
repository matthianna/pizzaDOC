'use client'

import { useState, useEffect } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Database } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function SignInPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [dbMessage, setDbMessage] = useState('Verificando connessione...')
  const router = useRouter()
  const { showToast, ToastContainer } = useToast()

  // Verifica lo stato del database all'avvio
  useEffect(() => {
    const checkDatabaseHealth = async () => {
      try {
        console.log('[LOGIN] Checking database health...')
        const response = await fetch('/api/health')
        console.log('[LOGIN] Health response status:', response.status)
        
        if (!response.ok) {
          console.error('[LOGIN] Health check failed with status:', response.status)
          setDbStatus('error')
          setDbMessage(`Errore HTTP ${response.status}`)
          return
        }

        const contentType = response.headers.get('content-type')
        console.log('[LOGIN] Content-Type:', contentType)
        
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text()
          console.error('[LOGIN] Non-JSON response:', text.substring(0, 200))
          setDbStatus('error')
          setDbMessage('Risposta non valida dal server')
          return
        }
        
        const data = await response.json()
        console.log('[LOGIN] Health check data:', data)
        
        if (data.status === 'ok') {
          setDbStatus('ok')
          setDbMessage(`Database OK (${data.userCount} utenti)`)
        } else {
          setDbStatus('error')
          setDbMessage(`Errore DB: ${data.message || 'Sconosciuto'}`)
        }
      } catch (error: any) {
        console.error('[LOGIN] Health check exception:', error)
        setDbStatus('error')
        setDbMessage(`Errore: ${error.message || 'Connessione fallita'}`)
      }
    }

    checkDatabaseHealth()
    
    // Ricontrolla ogni 30 secondi
    const interval = setInterval(checkDatabaseHealth, 30000)
    return () => clearInterval(interval)
  }, [])

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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-orange-200/20 rounded-full blur-3xl -ml-20 -mt-20 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-red-200/20 rounded-full blur-3xl -mr-32 -mb-32 animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo and Title */}
        <div className="text-center mb-10 animate-in fade-in zoom-in duration-700">
          <div className="inline-flex items-center justify-center w-28 h-28 mb-6 bg-gradient-to-br from-orange-500 to-red-600 rounded-[2rem] shadow-2xl shadow-orange-200 rotate-3 hover:rotate-0 transition-transform duration-500">
            <span className="text-5xl drop-shadow-lg">🍕</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">
            Pizza<span className="text-orange-600">DOC</span>
          </h1>
          <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Team Management System</p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-white p-8 sm:p-10 animate-in slide-in-from-bottom-8 duration-700">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-gray-900">Bentornato!</h2>
            <p className="text-gray-500 text-sm mt-1">Accedi per gestire i tuoi turni e disponibilità.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 animate-in shake duration-300">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <p className="text-xs font-bold text-red-700 uppercase tracking-wider">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="username" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                Nome Utente
              </label>
              <div className="relative group">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Es: mario.rossi"
                  className="w-full px-5 py-4 bg-gray-50 border-gray-100 border-2 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white focus:border-transparent transition-all placeholder-gray-300 group-hover:bg-white"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                Password Segreta
              </label>
              <div className="relative group">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-5 py-4 bg-gray-50 border-gray-100 border-2 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white focus:border-transparent transition-all placeholder-gray-300 group-hover:bg-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-orange-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 disabled:from-orange-300 disabled:to-orange-200 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest shadow-xl shadow-orange-200 transition-all active:scale-95 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Accesso in corso...</span>
                </>
              ) : (
                <>
                  <span>Accedi Ora</span>
                  <ChevronRightIcon className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Database Status Badge */}
        <div className="mt-8 flex justify-center animate-in fade-in duration-1000 delay-500">
          <div className={cn(
            "flex items-center gap-3 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border transition-all",
            dbStatus === 'ok' 
              ? 'bg-green-50 text-green-700 border-green-100'
              : dbStatus === 'error'
              ? 'bg-red-50 text-red-700 border-red-100'
              : 'bg-white/50 text-gray-500 border-gray-100'
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full shadow-sm",
              dbStatus === 'ok' ? 'bg-green-500' : dbStatus === 'error' ? 'bg-red-500' : 'bg-gray-300 animate-pulse'
            )} />
            <span>{dbMessage}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-10">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
            © 2026 PizzaDOC Official App
          </p>
        </div>
      </div>
      
      <ToastContainer />
    </div>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}
