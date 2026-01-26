'use client'

import { useState } from 'react'
import { useSession, signOut, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, Shield, Check, X, Sparkles, KeyRound } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

export default function FirstLoginPage() {
  const { data: session } = useSession()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { showToast, ToastContainer } = useToast()

  const isValidLength = password.length >= 6
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0
  const canSubmit = isValidLength && passwordsMatch && !isLoading

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
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: session?.user.id,
          newPassword: password
        })
      })

      const data = await response.json()

      if (response.ok) {
        showToast('Password cambiata con successo!', 'success')
        
        const username = session?.user.username
        
        if (username) {
          setTimeout(async () => {
            await signOut({ redirect: false })
            
            const result = await signIn('credentials', {
              username: username,
              password: password,
              redirect: false
            })
            
            if (result?.ok) {
              router.push('/dashboard')
              router.refresh()
            } else {
              showToast('Errore durante il re-login. Effettua il login manualmente.', 'error')
              router.push('/auth/signin')
            }
          }, 1500)
        } else {
          setTimeout(() => {
            router.push('/auth/signin')
          }, 1500)
        }
      } else {
        setError(data.error || 'Errore durante il cambio password')
        showToast(data.error || 'Errore durante il cambio password', 'error')
      }
    } catch (error) {
      setError('Errore di connessione. Riprova.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-orange-100/50 rounded-full blur-2xl" />
      
      <div className="w-full max-w-md relative z-10">
        {/* Header Card */}
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="relative inline-block mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-[2rem] shadow-2xl shadow-orange-200 flex items-center justify-center transform -rotate-6 hover:rotate-0 transition-transform duration-500">
              <img
                src="/logo.png"
                alt="PizzaDOC Logo"
                className="w-20 h-20 rounded-2xl object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const nextEl = e.currentTarget.nextElementSibling as HTMLElement
                  if (nextEl) nextEl.style.display = 'flex'
                }}
              />
              <span className="text-white font-bold text-4xl hidden items-center justify-center">🍕</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center shadow-lg animate-bounce">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>
          
          {/* Title */}
          <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-3">
            Benvenuto!
          </h1>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full mb-3">
            <span className="text-orange-600 font-black text-sm">Ciao</span>
            <span className="text-orange-800 font-black text-sm">{session?.user.username}</span>
            <span className="text-orange-600">👋</span>
          </div>
          <p className="text-gray-500 text-sm font-medium">
            Prima di iniziare, imposta la tua password personale
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-white p-8 relative overflow-hidden">
          {/* Card decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-100/50 to-transparent rounded-full blur-2xl -mr-10 -mt-10" />
          
          {/* Icon header */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-100">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
                <KeyRound className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Sicurezza</p>
                <p className="text-sm font-black text-gray-900">Nuova Password</p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
              <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <X className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-bold text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Password field */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                Nuova Password
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Lock className={cn(
                    "w-5 h-5 transition-colors",
                    password.length > 0 
                      ? isValidLength ? "text-green-500" : "text-red-400"
                      : "text-gray-300"
                  )} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 6 caratteri"
                  className={cn(
                    "w-full pl-12 pr-12 py-4 border-2 rounded-2xl text-sm font-bold text-gray-900 bg-gray-50 focus:bg-white focus:outline-none transition-all placeholder-gray-400",
                    password.length > 0 
                      ? isValidLength 
                        ? "border-green-300 focus:border-green-500 focus:ring-4 focus:ring-green-100" 
                        : "border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                      : "border-gray-100 focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  )}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              
              {/* Password strength indicator */}
              <div className="flex items-center gap-2 mt-2 ml-1">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-all duration-300",
                        password.length >= i * 2 
                          ? password.length >= 8 ? "bg-green-500" : password.length >= 6 ? "bg-yellow-500" : "bg-red-400"
                          : "bg-gray-200"
                      )}
                    />
                  ))}
                </div>
                {password.length > 0 && (
                  <span className={cn(
                    "text-[10px] font-black uppercase",
                    isValidLength ? "text-green-600" : "text-red-500"
                  )}>
                    {password.length >= 8 ? "Forte" : password.length >= 6 ? "OK" : `${password.length}/6`}
                  </span>
                )}
              </div>
            </div>

            {/* Confirm Password field */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                Conferma Password
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Shield className={cn(
                    "w-5 h-5 transition-colors",
                    confirmPassword.length > 0 
                      ? passwordsMatch ? "text-green-500" : "text-red-400"
                      : "text-gray-300"
                  )} />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ripeti la password"
                  className={cn(
                    "w-full pl-12 pr-12 py-4 border-2 rounded-2xl text-sm font-bold text-gray-900 bg-gray-50 focus:bg-white focus:outline-none transition-all placeholder-gray-400",
                    confirmPassword.length > 0 
                      ? passwordsMatch 
                        ? "border-green-300 focus:border-green-500 focus:ring-4 focus:ring-green-100" 
                        : "border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                      : "border-gray-100 focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  )}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              
              {/* Match indicator */}
              {confirmPassword.length > 0 && (
                <div className={cn(
                  "flex items-center gap-2 mt-2 ml-1 animate-in slide-in-from-left-2",
                  passwordsMatch ? "text-green-600" : "text-red-500"
                )}>
                  {passwordsMatch ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span className="text-xs font-bold">Le password coincidono</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      <span className="text-xs font-bold">Le password non coincidono</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "w-full py-5 rounded-2xl text-sm font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-3",
                canSubmit
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-xl shadow-orange-200 hover:shadow-2xl hover:shadow-orange-300 hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Aggiornamento...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Imposta Password</span>
                </>
              )}
            </button>
          </form>

          {/* Info note */}
          <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-2xl flex items-start gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-black text-green-800 mb-0.5">Accesso Automatico</p>
              <p className="text-[11px] text-green-600 font-medium leading-relaxed">
                Dopo il cambio password, entrerai direttamente nel sistema.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs font-bold text-gray-400">
            © {new Date().getFullYear()} PizzaDOC • Tutti i diritti riservati
          </p>
        </div>
      </div>
      
      <ToastContainer />
    </div>
  )
}
