'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Send, CheckCircle, XCircle, Loader2, Smartphone, AlertCircle } from 'lucide-react'

export default function WhatsAppTestPage() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [sessionStatus, setSessionStatus] = useState<any>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)

  useEffect(() => {
    checkWAHAStatus()
  }, [])

  const checkWAHAStatus = async () => {
    setCheckingStatus(true)
    try {
      let wahaUrl = process.env.NEXT_PUBLIC_WAHA_URL || 'https://waha-production-ce21.up.railway.app'
      
      // Normalizza URL: aggiungi https:// se manca
      if (wahaUrl && !wahaUrl.startsWith('http://') && !wahaUrl.startsWith('https://')) {
        wahaUrl = `https://${wahaUrl}`
      }
      
      const session = process.env.NEXT_PUBLIC_WAHA_SESSION || 'default'
      
      console.log('🔍 Checking WAHA status:', { wahaUrl, session })
      
      const response = await fetch(`${wahaUrl}/api/sessions/${session}`)
      if (response.ok) {
        const data = await response.json()
        console.log('✅ WAHA session data:', data)
        setSessionStatus({ ...data, wahaUrl, sessionName: session })
      } else {
        console.error('❌ Session not found:', response.status)
        setSessionStatus({ error: `Session '${session}' not found. Create it in WAHA dashboard.`, wahaUrl, sessionName: session })
      }
    } catch (error) {
      console.error('Error checking WAHA status:', error)
      setSessionStatus({ error: 'Cannot connect to WAHA. Check if WAHA is running.', wahaUrl: process.env.NEXT_PUBLIC_WAHA_URL || 'Not configured' })
    } finally {
      setCheckingStatus(false)
    }
  }

  const handleSendTest = async () => {
    if (!phoneNumber || !message) {
      setResult({ success: false, message: 'Inserisci numero e messaggio' })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, message }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult({ success: true, message: 'Messaggio inviato con successo!' })
        setMessage('')
      } else {
        setResult({ success: false, message: data.error || 'Errore durante l\'invio' })
      }
    } catch (error) {
      console.error('Error sending test message:', error)
      setResult({ success: false, message: 'Errore di connessione' })
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WORKING':
        return 'text-green-500'
      case 'SCAN_QR_CODE':
        return 'text-yellow-500'
      case 'FAILED':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'WORKING':
        return <CheckCircle className="w-5 h-5" />
      case 'SCAN_QR_CODE':
        return <AlertCircle className="w-5 h-5" />
      case 'FAILED':
        return <XCircle className="w-5 h-5" />
      default:
        return <Loader2 className="w-5 h-5 animate-spin" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-green-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Test WhatsApp
              </h1>
              <p className="text-gray-600 mt-1">
                Verifica l'integrazione con WAHA e invia messaggi di test
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-green-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Stato Connessione</h2>
          </div>

          {checkingStatus ? (
            <div className="flex items-center gap-3 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Controllo stato...</span>
            </div>
          ) : sessionStatus?.error ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <XCircle className="w-5 h-5" />
                <span className="font-semibold">Errore di connessione</span>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700 mb-2">
                  <strong>Problema:</strong> {sessionStatus.error}
                </p>
                <p className="text-sm text-red-600">
                  Verifica che WAHA sia configurato correttamente e accessibile.
                </p>
              </div>
              <button
                onClick={checkWAHAStatus}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Riprova
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`flex items-center gap-3 ${getStatusColor(sessionStatus?.status)}`}>
                {getStatusIcon(sessionStatus?.status)}
                <span className="font-semibold">
                  {sessionStatus?.status === 'WORKING'
                    ? 'Connesso e funzionante'
                    : sessionStatus?.status === 'SCAN_QR_CODE'
                    ? 'In attesa di scansione QR'
                    : 'Stato: ' + sessionStatus?.status}
                </span>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">WAHA URL:</span>
                  <span className="font-mono text-xs text-gray-800">{sessionStatus?.wahaUrl || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sessione:</span>
                  <span className="font-semibold text-gray-800">{sessionStatus?.sessionName || sessionStatus?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Configurazione:</span>
                  <span className="font-semibold text-gray-800">
                    {process.env.NEXT_PUBLIC_WHATSAPP_ENABLED === 'true' ? (
                      <span className="text-green-600">✓ Abilitato</span>
                    ) : (
                      <span className="text-red-600">✗ Disabilitato</span>
                    )}
                  </span>
                </div>
              </div>

              {sessionStatus?.status === 'SCAN_QR_CODE' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Azione richiesta:</strong> Vai alla dashboard WAHA e scansiona il QR code con WhatsApp.
                  </p>
                </div>
              )}

              <button
                onClick={checkWAHAStatus}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Aggiorna Stato
              </button>
            </div>
          )}
        </div>

        {/* Send Test Message Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-green-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <Send className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Invia Test</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Numero WhatsApp
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+393331234567"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">Formato: +39 seguito dal numero</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Messaggio
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Scrivi il messaggio di test..."
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
                disabled={loading}
              />
            </div>

            <button
              onClick={handleSendTest}
              disabled={loading || !phoneNumber || !message}
              className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Invio in corso...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Invia Messaggio</span>
                </>
              )}
            </button>

            {result && (
              <div
                className={`p-4 rounded-xl border ${
                  result.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span
                    className={`text-sm font-semibold ${
                      result.success ? 'text-green-800' : 'text-red-800'
                    }`}
                  >
                    {result.message}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="max-w-4xl mx-auto mt-6">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-900">Informazioni</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Il numero deve essere nel formato internazionale (+393331234567)</li>
                <li>• Assicurati che WAHA sia connesso e lo stato sia "WORKING"</li>
                <li>• Consulta WHATSAPP_SETUP.md per istruzioni complete</li>
                <li>• I messaggi vengono inviati dal numero configurato in WAHA</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
