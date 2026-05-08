'use client'

import { useState } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { KeyRound, Copy, Check, Loader2, ShieldAlert } from 'lucide-react'

export default function AdminBcryptPage() {
  const [plaintext, setPlaintext] = useState('')
  const [hash, setHash] = useState('')
  const [cost, setCost] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setError(null)
    setHash('')
    setCost(null)
    setCopied(false)
    if (!plaintext) {
      setError('Inserisci la password in chiaro.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/bcrypt-hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: plaintext }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Errore')
        return
      }
      setHash(data.hash)
      setCost(typeof data.cost === 'number' ? data.cost : 12)
    } catch {
      setError('Errore di rete')
    } finally {
      setLoading(false)
    }
  }

  const copyHash = async () => {
    if (!hash) return
    await navigator.clipboard.writeText(hash)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-8 pb-16">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-orange-100 text-orange-700">
            <KeyRound className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hash password (bcrypt)</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Genera l&apos;hash come fa l&apos;app (bcryptjs, cost {12}). Incolla il risultato nel campo{' '}
              <code className="text-xs bg-gray-100 px-1 rounded">password</code> su DB solo se sai cosa stai facendo.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            Pagina riservata agli admin. Dopo aver aggiornato il DB, l&apos;utente potrebbe dover usare{' '}
            <strong>cambia password</strong> o <strong>primo accesso</strong> se lo stato non corrisponde. Non condividere
            password in chiaro.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">Password in chiaro</span>
            <input
              type="password"
              autoComplete="off"
              value={plaintext}
              onChange={(e) => setPlaintext(e.target.value)}
              className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow"
              placeholder="Password da hashare"
            />
          </label>

          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Elaborazione…
              </>
            ) : (
              <>
                <KeyRound className="w-5 h-5" />
                Genera hash
              </>
            )}
          </button>

          {error && (
            <p className="text-sm text-red-600 font-medium" role="alert">
              {error}
            </p>
          )}
        </div>

        {hash && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-700">Hash (per colonna password)</span>
              {cost !== null && (
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  bcrypt cost {cost}
                </span>
              )}
            </div>
            <textarea
              readOnly
              value={hash}
              className="w-full min-h-[120px] font-mono text-sm p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 break-all"
            />
            <button
              type="button"
              onClick={copyHash}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-600" />
                  Copiato
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copia hash
                </>
              )}
            </button>
            <p className="text-xs text-gray-500">
              Esempio SQL (sostituisci <code className="bg-gray-100 px-1 rounded">&lt;hash&gt;</code> e il filtro{' '}
              <code className="bg-gray-100 px-1 rounded">WHERE</code>):{' '}
              <code className="block mt-1 p-2 bg-gray-100 rounded-lg break-all text-[11px]">
                {`UPDATE users SET password = '<hash>', "updatedAt" = NOW() WHERE username = 'nome_utente';`}
              </code>
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
