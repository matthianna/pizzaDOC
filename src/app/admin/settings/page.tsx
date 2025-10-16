'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Cog6ToothIcon, CheckIcon } from '@heroicons/react/24/outline'
import { MessageSquare, Check, X, AlertCircle, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

interface Settings {
  scooter_count: string
}

interface WhatsAppSettings {
  groupChatId: string
  notificationsEnabled: boolean
  wahaConfigured: boolean
  wahaStatus: string
  wahaError?: string
}

interface CronSettings {
  schedule: string
  enabled: boolean
  vercelSchedule: string
}

interface ShiftLimit {
  id?: string
  dayOfWeek: number
  shiftType: 'PRANZO' | 'CENA'
  role: 'PIZZAIOLO' | 'CUCINA' | 'FATTORINO' | 'SALA'
  requiredStaff: number
}

type Role = 'PIZZAIOLO' | 'CUCINA' | 'FATTORINO' | 'SALA'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    scooter_count: '3'
  })
  const [whatsappSettings, setWhatsappSettings] = useState<WhatsAppSettings>({
    groupChatId: '',
    notificationsEnabled: false,
    wahaConfigured: false,
    wahaStatus: 'Unknown',
    wahaError: undefined
  })
  const [cronSettings, setCronSettings] = useState<CronSettings>({
    schedule: '0 12 * * 0',
    enabled: true,
    vercelSchedule: '0 12 * * 0'
  })
  const [shiftLimits, setShiftLimits] = useState<ShiftLimit[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [savingLimits, setSavingLimits] = useState(false)
  const [savingWhatsApp, setSavingWhatsApp] = useState(false)
  const [savingCron, setSavingCron] = useState(false)
  const [triggeringCron, setTriggeringCron] = useState(false)
  const [testingWhatsApp, setTestingWhatsApp] = useState(false)
  const [selectedShift, setSelectedShift] = useState<'PRANZO' | 'CENA'>('PRANZO')
  const { showToast, ToastContainer } = useToast()

  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
  const roles: Role[] = ['PIZZAIOLO', 'CUCINA', 'FATTORINO', 'SALA']

  const roleLabels: Record<Role, string> = {
    PIZZAIOLO: 'Pizzaiolo',
    CUCINA: 'Cucina',
    FATTORINO: 'Fattorino',
    SALA: 'Sala'
  }

  const parseCronSchedule = (schedule: string): string => {
    const parts = schedule.split(' ')
    if (parts.length !== 5) return 'Formato non valido'

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

    let description = ''

    // Day of week
    if (dayOfWeek !== '*') {
      description += days[parseInt(dayOfWeek)] + ' '
    } else if (dayOfMonth !== '*') {
      description += `giorno ${dayOfMonth} `
    } else {
      description += 'ogni giorno '
    }

    // Time
    description += `alle ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`

    return description
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [settingsResponse, limitsResponse, whatsappResponse, cronResponse] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/shift-limits'),
        fetch('/api/admin/whatsapp/settings'),
        fetch('/api/admin/cron/settings')
      ])
      
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json()
        setSettings({
          scooter_count: settingsData.scooter_count || '3'
        })
      }

      if (limitsResponse.ok) {
        const limitsData = await limitsResponse.json()
        setShiftLimits(limitsData)
      }

      if (whatsappResponse.ok) {
        const whatsappData = await whatsappResponse.json()
        setWhatsappSettings(whatsappData)
      }

      if (cronResponse.ok) {
        const cronData = await cronResponse.json()
        setCronSettings(cronData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveWhatsAppSettings = async () => {
    setSavingWhatsApp(true)
    try {
      const response = await fetch('/api/admin/whatsapp/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          groupChatId: whatsappSettings.groupChatId,
          notificationsEnabled: whatsappSettings.notificationsEnabled
        })
      })

      if (response.ok) {
        showToast('✅ Impostazioni WhatsApp salvate!', 'success')
        await fetchData() // Refresh per aggiornare lo stato
      } else {
        const error = await response.json()
        showToast(`❌ ${error.error || 'Errore durante il salvataggio'}`, 'error')
      }
    } catch (error) {
      console.error('Error saving WhatsApp settings:', error)
      showToast('❌ Errore durante il salvataggio', 'error')
    } finally {
      setSavingWhatsApp(false)
    }
  }

  const testWhatsAppNotification = async () => {
    if (!whatsappSettings.groupChatId) {
      showToast('⚠️ Configura prima il Group Chat ID', 'error')
      return
    }

    setTestingWhatsApp(true)
    try {
      const response = await fetch('/api/admin/whatsapp/test-group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          groupChatId: whatsappSettings.groupChatId
        })
      })

      const data = await response.json()

      if (response.ok) {
        showToast('✅ Messaggio di test inviato al gruppo!', 'success')
      } else {
        showToast(`❌ ${data.error || 'Errore durante l\'invio'}`, 'error')
      }
    } catch (error) {
      console.error('Error testing WhatsApp:', error)
      showToast('❌ Errore durante il test', 'error')
    } finally {
      setTestingWhatsApp(false)
    }
  }

  const saveCronSettings = async () => {
    setSavingCron(true)
    try {
      const response = await fetch('/api/admin/cron/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          schedule: cronSettings.schedule,
          enabled: cronSettings.enabled
        })
      })

      const data = await response.json()

      if (response.ok) {
        showToast('✅ Impostazioni Cron salvate!', 'success')
        
        // Mostra avviso se lo schedule è diverso da quello di Vercel
        if (cronSettings.schedule !== cronSettings.vercelSchedule) {
          showToast('⚠️ Ricorda di aggiornare vercel.json e ridepoyare!', 'info')
        }
      } else {
        showToast(`❌ ${data.error || 'Errore durante il salvataggio'}`, 'error')
      }
    } catch (error) {
      console.error('Error saving cron settings:', error)
      showToast('❌ Errore durante il salvataggio', 'error')
    } finally {
      setSavingCron(false)
    }
  }

  const triggerCronManually = async () => {
    setTriggeringCron(true)
    try {
      const response = await fetch('/api/admin/cron/trigger-availability-reminder', {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        showToast('✅ Cron job avviato con successo!', 'success')
        
        // Mostra dettagli se disponibili
        if (data.data) {
          console.log('Cron job result:', data.data)
        }
      } else {
        showToast(`❌ ${data.error || 'Errore durante l\'esecuzione'}`, 'error')
      }
    } catch (error) {
      console.error('Error triggering cron:', error)
      showToast('❌ Errore durante l\'esecuzione', 'error')
    } finally {
      setTriggeringCron(false)
    }
  }

  const saveSetting = async (key: keyof Settings, value: string, description: string) => {
    setSaving(key)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key,
          value,
          description
        })
      })

      if (response.ok) {
        showToast('✅ Impostazione salvata!', 'success')
      } else {
        showToast('❌ Errore durante il salvataggio', 'error')
      }
    } catch (error) {
      console.error('Error saving setting:', error)
      showToast('❌ Errore durante il salvataggio', 'error')
    } finally {
      setSaving('')
    }
  }

  const updateShiftLimit = (dayOfWeek: number, shiftType: 'PRANZO' | 'CENA', role: Role, value: number) => {
    setShiftLimits(prev => {
      const existing = prev.find(limit => 
        limit.dayOfWeek === dayOfWeek && 
        limit.shiftType === shiftType && 
        limit.role === role
      )

      if (existing) {
        return prev.map(limit => 
          limit.dayOfWeek === dayOfWeek && 
          limit.shiftType === shiftType && 
          limit.role === role
            ? { ...limit, requiredStaff: value }
            : limit
        )
      } else {
        return [...prev, {
          dayOfWeek,
          shiftType,
          role,
          requiredStaff: value
        }]
      }
    })
  }

  const getShiftLimit = (dayOfWeek: number, shiftType: 'PRANZO' | 'CENA', role: Role): number => {
    const limit = shiftLimits.find(l => 
      l.dayOfWeek === dayOfWeek && 
      l.shiftType === shiftType && 
      l.role === role
    )
    return limit?.requiredStaff ?? 0
  }

  const saveShiftLimits = async () => {
    setSavingLimits(true)
    try {
      // Prepara TUTTI i limiti per ogni combinazione giorno/turno/ruolo
      const allLimits: ShiftLimit[] = []
      
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        for (const shiftType of ['PRANZO', 'CENA'] as const) {
          for (const role of roles) {
            const value = getShiftLimit(dayIndex, shiftType, role)
            // Invia TUTTI i limiti, anche quelli con 0
            allLimits.push({
              dayOfWeek: dayIndex,
              shiftType,
              role,
              requiredStaff: value
            })
          }
        }
      }
      
      const response = await fetch('/api/admin/shift-limits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limits: allLimits })
      })

      if (response.ok) {
        showToast('✅ Limiti salvati con successo!', 'success')
        await fetchData() // Refresh data
      } else {
        showToast('❌ Errore durante il salvataggio', 'error')
      }
    } catch (error) {
      console.error('Error saving limits:', error)
      showToast('❌ Errore durante il salvataggio', 'error')
    } finally {
      setSavingLimits(false)
    }
  }

  if (loading) {
    return (
      <MainLayout adminOnly>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout adminOnly>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Cog6ToothIcon className="h-7 w-7 text-gray-400" />
            Configurazioni Sistema
          </h1>
            <p className="text-sm text-gray-500 mt-1">
            Gestisci le impostazioni generali del sistema
          </p>
          </div>
        </div>

        {/* Scooter Configuration */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                <span className="text-xl">🛵</span>
            </div>
            <div>
                <h3 className="font-semibold text-gray-900">Scooter Disponibili</h3>
                <p className="text-xs text-gray-500">Numero di scooter per le consegne</p>
              </div>
          </div>

            <div className="flex items-center gap-3">
              <input
              type="number"
                min="1"
                max="20"
              value={settings.scooter_count}
              onChange={(e) => setSettings({ ...settings, scooter_count: e.target.value })}
                className="w-20 h-10 text-center text-lg font-semibold border-2 border-gray-200 rounded-lg focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
            />
            <Button
                onClick={() => saveSetting('scooter_count', settings.scooter_count, 'Numero di scooter disponibili')}
              isLoading={saving === 'scooter_count'}
                className="bg-orange-600 hover:bg-orange-700"
              size="sm"
            >
                {saving === 'scooter_count' ? 'Salvataggio...' : 'Salva'}
            </Button>
            </div>
          </div>
        </div>

        {/* WhatsApp Configuration */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Notifiche WhatsApp</h3>
                <p className="text-xs text-gray-500">Configura le notifiche automatiche per le sostituzioni</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Status Badge */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-700">Stato Connessione WAHA:</span>
                  {whatsappSettings.wahaStatus === 'WORKING' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                      <Check className="w-3.5 h-3.5" />
                      Connesso
                    </span>
                  ) : whatsappSettings.wahaStatus === 'SCAN_QR_CODE' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Scansiona QR
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                      <X className="w-3.5 h-3.5" />
                      Non connesso
                    </span>
                  )}
                </div>
                {whatsappSettings.wahaError && (
                  <p className="text-xs text-red-600">⚠️ {whatsappSettings.wahaError}</p>
                )}
              </div>
            </div>

            {/* Group Chat ID */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Group Chat ID
              </label>
              <input
                type="text"
                value={whatsappSettings.groupChatId}
                onChange={(e) => setWhatsappSettings({ ...whatsappSettings, groupChatId: e.target.value })}
                placeholder="120363420442904155@g.us"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 ID del gruppo WhatsApp dove inviare le notifiche delle sostituzioni
              </p>
            </div>

            {/* Enable Notifications Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Abilita Notifiche</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Invia automaticamente un messaggio al gruppo quando viene richiesta una sostituzione
                </p>
              </div>
              <button
                onClick={() => setWhatsappSettings({ 
                  ...whatsappSettings, 
                  notificationsEnabled: !whatsappSettings.notificationsEnabled 
                })}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  whatsappSettings.notificationsEnabled ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
                    whatsappSettings.notificationsEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={saveWhatsAppSettings}
                isLoading={savingWhatsApp}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                leftIcon={!savingWhatsApp ? <CheckIcon className="w-4 h-4" /> : undefined}
              >
                Salva Impostazioni
              </Button>
              <Button
                onClick={testWhatsAppNotification}
                isLoading={testingWhatsApp}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!whatsappSettings.groupChatId || whatsappSettings.wahaStatus !== 'WORKING'}
              >
                {testingWhatsApp ? 'Invio...' : '🧪 Test Messaggio'}
              </Button>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-blue-900">Come ottenere il Group Chat ID:</h4>
                  <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Vai su <span className="font-mono bg-blue-100 px-1 rounded">/admin/whatsapp-test</span></li>
                    <li>Usa il metodo API per ottenere l&apos;ID del gruppo</li>
                    <li>Oppure controlla i log WAHA dopo aver inviato un messaggio al gruppo</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cron Job Configuration */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-5 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-600 rounded-xl shadow-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">⏰ Cron Job - Promemoria Disponibilità</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Gestisci il promemoria automatico per le disponibilità mancanti
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Stato Cron */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Stato Cron Job</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {cronSettings.enabled ? 'Il cron job è attivo' : 'Il cron job è disabilitato'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {cronSettings.enabled ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                      <Check className="w-3.5 h-3.5" />
                      Attivo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                      <X className="w-3.5 h-3.5" />
                      Disattivo
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Schedule Configuration */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Schedule Cron (formato cron)
              </label>
              <input
                type="text"
                value={cronSettings.schedule}
                onChange={(e) => setCronSettings({ ...cronSettings, schedule: e.target.value })}
                placeholder="0 12 * * 0"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all font-mono text-sm"
              />
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-500">
                  💡 Formato: <span className="font-mono bg-gray-100 px-1 rounded">minuto ora giorno mese giorno-settimana</span>
                </p>
                <p className="text-xs text-gray-500">
                  🕐 Attuale: <span className="font-mono bg-purple-100 px-1 rounded">{cronSettings.schedule}</span> = {parseCronSchedule(cronSettings.schedule)}
                </p>
                {cronSettings.schedule !== cronSettings.vercelSchedule && (
                  <p className="text-xs text-orange-600 font-semibold">
                    ⚠️ Lo schedule è diverso da quello configurato in vercel.json ({cronSettings.vercelSchedule})
                  </p>
                )}
              </div>
            </div>

            {/* Enable Cron Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Abilita Cron Job</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Attiva o disattiva il promemoria automatico
                </p>
              </div>
              <button
                onClick={() => setCronSettings({ 
                  ...cronSettings, 
                  enabled: !cronSettings.enabled 
                })}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  cronSettings.enabled ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
                    cronSettings.enabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={saveCronSettings}
                isLoading={savingCron}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                leftIcon={!savingCron ? <CheckIcon className="w-4 h-4" /> : undefined}
              >
                Salva Impostazioni
              </Button>
              <Button
                onClick={triggerCronManually}
                isLoading={triggeringCron}
                className="bg-orange-600 hover:bg-orange-700"
                disabled={!cronSettings.enabled}
              >
                {triggeringCron ? 'Avvio...' : '🚀 Avvia Ora'}
              </Button>
            </div>

            {/* Info */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-purple-900">Come funziona:</h4>
                  <ul className="text-xs text-purple-800 space-y-1 list-disc list-inside">
                    <li>Il cron job viene eseguito automaticamente secondo lo schedule configurato</li>
                    <li>Controlla quali dipendenti non hanno inserito la disponibilità per la settimana successiva</li>
                    <li>Invia un promemoria WhatsApp al gruppo e ai singoli dipendenti</li>
                    <li>Puoi avviarlo manualmente in qualsiasi momento con il pulsante "Avvia Ora"</li>
                  </ul>
                  <div className="mt-3 pt-3 border-t border-purple-200">
                    <h4 className="text-xs font-semibold text-purple-900 mb-1">Per modificare lo schedule su Vercel:</h4>
                    <ol className="text-xs text-purple-800 space-y-1 list-decimal list-inside">
                      <li>Modifica <span className="font-mono bg-purple-100 px-1 rounded">vercel.json</span> con il nuovo schedule</li>
                      <li>Fai commit e push delle modifiche</li>
                      <li>Rideploya l&apos;applicazione su Vercel</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Shift Limits Configuration */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header with Toggle */}
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <span className="text-xl">👥</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Limiti Personale per Turno</h3>
                  <p className="text-xs text-gray-500">Configura il personale richiesto per ogni turno e ruolo</p>
                </div>
              </div>

            <Button
              onClick={saveShiftLimits}
              isLoading={savingLimits}
                className="bg-orange-600 hover:bg-orange-700"
                leftIcon={!savingLimits ? <CheckIcon className="w-4 h-4" /> : undefined}
            >
                💾 Salva Tutti i Limiti
            </Button>
            </div>

            {/* Toggle Switch */}
            <div className="mt-6 flex items-center justify-center">
              <div className="inline-flex items-center bg-gray-100 rounded-lg p-1 gap-1">
                <button
                  onClick={() => setSelectedShift('PRANZO')}
                  className={`px-6 py-2.5 rounded-md font-medium text-sm transition-all duration-200 ${
                    selectedShift === 'PRANZO'
                      ? 'bg-white text-orange-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>🍕</span>
                    <span>PRANZO</span>
                    <span className="text-xs text-gray-500">11:00-14:00</span>
                  </span>
                </button>
                <button
                  onClick={() => setSelectedShift('CENA')}
                  className={`px-6 py-2.5 rounded-md font-medium text-sm transition-all duration-200 ${
                    selectedShift === 'CENA'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>🍝</span>
                    <span>CENA</span>
                    <span className="text-xs text-gray-500">17:00-22:00</span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-40">
                    Giorno
                  </th>
                  {roles.map(role => (
                    <th key={role} className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {roleLabels[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {days.map((day, dayIndex) => (
                  <tr key={dayIndex} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{day}</span>
                      </td>
                      {roles.map(role => {
                      const value = getShiftLimit(dayIndex, selectedShift, role)
                        return (
                        <td key={role} className="px-6 py-4 whitespace-nowrap">
                          <div className="flex justify-center">
                            <input
                                  type="number"
                                  min="0"
                                  max="10"
                              value={value}
                              onChange={(e) => updateShiftLimit(
                                dayIndex, 
                                selectedShift, 
                                role, 
                                parseInt(e.target.value) || 0
                              )}
                              className="w-16 h-12 text-center text-lg font-semibold border-2 border-gray-200 rounded-lg hover:border-orange-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all"
                              placeholder="0"
                            />
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Info */}
          <div className="px-6 py-4 bg-blue-50 border-t border-blue-100">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <span className="text-lg">💡</span>
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-blue-900 mb-2">Come funziona:</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• <strong>Personale Richiesto:</strong> Numero di persone necessarie per quel turno e ruolo</li>
                  <li>• <strong>Valore 0:</strong> Nessun requisito per quella combinazione (verrà ignorata)</li>
                  <li>• <strong>Generazione Automatica:</strong> L&apos;algoritmo userà questi valori per assegnare i turni</li>
                  <li>• <strong>Gap Alert:</strong> Il sistema ti avviserà se mancano persone rispetto ai requisiti</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </MainLayout>
  )
}
