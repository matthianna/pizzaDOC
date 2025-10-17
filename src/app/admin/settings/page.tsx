'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Cog6ToothIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { MessageSquare, Check, X, AlertCircle } from 'lucide-react'
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

interface ShiftLimit {
  id?: string
  dayOfWeek: number
  shiftType: 'PRANZO' | 'CENA'
  role: 'PIZZAIOLO' | 'CUCINA' | 'FATTORINO' | 'SALA'
  requiredStaff: number
}

interface StartTimeDistribution {
  id?: string
  dayOfWeek: number
  shiftType: 'PRANZO' | 'CENA'
  role: 'PIZZAIOLO' | 'CUCINA' | 'FATTORINO' | 'SALA'
  startTime: string
  targetCount: number
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
  const [shiftLimits, setShiftLimits] = useState<ShiftLimit[]>([])
  const [distributions, setDistributions] = useState<StartTimeDistribution[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [savingLimits, setSavingLimits] = useState(false)
  const [savingWhatsApp, setSavingWhatsApp] = useState(false)
  const [savingDistributions, setSavingDistributions] = useState(false)
  const [testingWhatsApp, setTestingWhatsApp] = useState(false)
  const [selectedShift, setSelectedShift] = useState<'PRANZO' | 'CENA'>('PRANZO')
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [shiftLimitsOpen, setShiftLimitsOpen] = useState(false)
  const [startTimesOpen, setStartTimesOpen] = useState(false)
  const { showToast, ToastContainer } = useToast()

  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
  const roles: Role[] = ['PIZZAIOLO', 'CUCINA', 'FATTORINO', 'SALA']

  const roleLabels: Record<Role, string> = {
    PIZZAIOLO: 'Pizzaiolo',
    CUCINA: 'Cucina',
    FATTORINO: 'Fattorino',
    SALA: 'Sala'
  }

  // Orari disponibili per turno e ruolo
  const getAvailableStartTimes = (shiftType: 'PRANZO' | 'CENA', role: Role): string[] => {
    if (shiftType === 'PRANZO') {
      if (role === 'SALA' || role === 'FATTORINO') {
        return ['11:30', '12:00']
      } else {
        return ['11:00', '11:30']
      }
    } else { // CENA
      if (role === 'FATTORINO') {
        return ['18:00', '18:30', '19:00']
      } else if (role === 'SALA') {
        return ['18:00', '18:30']
      } else {
        return ['17:00', '18:00', '18:30']
      }
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [settingsResponse, limitsResponse, whatsappResponse, distributionsResponse] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/shift-limits'),
        fetch('/api/admin/whatsapp/settings'),
        fetch('/api/admin/start-time-distributions')
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

      if (distributionsResponse.ok) {
        const distributionsData = await distributionsResponse.json()
        setDistributions(distributionsData)
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

  // Funzioni per la gestione degli orari di inizio
  const getRequiredStaff = (dayOfWeek: number, shiftType: 'PRANZO' | 'CENA', role: Role): number => {
    const limit = shiftLimits.find(l => 
      l.dayOfWeek === dayOfWeek && 
      l.shiftType === shiftType && 
      l.role === role
    )
    return limit?.requiredStaff ?? 0
  }

  const getDistributedCount = (dayOfWeek: number, shiftType: 'PRANZO' | 'CENA', role: Role): number => {
    const roleDistributions = distributions.filter(d => 
      d.dayOfWeek === dayOfWeek && 
      d.shiftType === shiftType && 
      d.role === role
    )
    return roleDistributions.reduce((sum, d) => sum + d.targetCount, 0)
  }

  const getTargetCount = (
    dayOfWeek: number, 
    shiftType: 'PRANZO' | 'CENA', 
    role: Role, 
    startTime: string
  ): number => {
    const dist = distributions.find(d => 
      d.dayOfWeek === dayOfWeek && 
      d.shiftType === shiftType && 
      d.role === role &&
      d.startTime === startTime
    )
    return dist?.targetCount ?? 0
  }

  const updateDistribution = (
    dayOfWeek: number, 
    shiftType: 'PRANZO' | 'CENA', 
    role: Role, 
    startTime: string, 
    value: number
  ) => {
    const required = getRequiredStaff(dayOfWeek, shiftType, role)
    
    // Calcola il totale distribuito escludendo questo orario
    const otherDistributions = distributions.filter(d => 
      d.dayOfWeek === dayOfWeek && 
      d.shiftType === shiftType && 
      d.role === role &&
      d.startTime !== startTime
    )
    const otherTotal = otherDistributions.reduce((sum, d) => sum + d.targetCount, 0)
    
    // Non permettere di superare il limite
    if (otherTotal + value > required) {
      showToast(`⚠️ Non puoi superare ${required} ${roleLabels[role].toLowerCase()}!`, 'error')
      return
    }

    setDistributions(prev => {
      const existing = prev.find(d => 
        d.dayOfWeek === dayOfWeek && 
        d.shiftType === shiftType && 
        d.role === role &&
        d.startTime === startTime
      )

      if (existing) {
        return prev.map(d => 
          d.dayOfWeek === dayOfWeek && 
          d.shiftType === shiftType && 
          d.role === role &&
          d.startTime === startTime
            ? { ...d, targetCount: value }
            : d
        )
      } else {
        return [...prev, {
          dayOfWeek,
          shiftType,
          role,
          startTime,
          targetCount: value
        }]
      }
    })
  }

  const saveDistributions = async () => {
    setSavingDistributions(true)
    try {
      // Prepara TUTTE le distribuzioni per ogni combinazione possibile
      const allDistributions: StartTimeDistribution[] = []
      
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        for (const shiftType of ['PRANZO', 'CENA'] as const) {
          for (const role of roles) {
            const availableTimes = getAvailableStartTimes(shiftType, role)
            for (const startTime of availableTimes) {
              const value = getTargetCount(dayIndex, shiftType, role, startTime)
              // Invia TUTTE le distribuzioni, anche quelle con 0
              allDistributions.push({
                dayOfWeek: dayIndex,
                shiftType,
                role,
                startTime,
                targetCount: value
              })
            }
          }
        }
      }
      
      const responses = await Promise.all(
        allDistributions.map(dist =>
          fetch('/api/admin/start-time-distributions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dist)
          })
        )
      )

      const allSuccessful = responses.every(r => r.ok)
      if (allSuccessful) {
        showToast('✅ Orari salvati con successo!', 'success')
        await fetchData()
      } else {
        showToast('❌ Errore durante il salvataggio', 'error')
      }
    } catch (error) {
      console.error('Error saving distributions:', error)
      showToast('❌ Errore durante il salvataggio', 'error')
    } finally {
      setSavingDistributions(false)
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

        {/* WhatsApp Configuration - Collapsible */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setWhatsappOpen(!whatsappOpen)}
            className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">Notifiche WhatsApp</h3>
                <p className="text-xs text-gray-500">Configura le notifiche automatiche per le sostituzioni</p>
              </div>
            </div>
            {whatsappOpen ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {whatsappOpen && (
            <div className="border-t border-gray-200">
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
          )}
        </div>

        {/* Shift Limits Configuration - Collapsible */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header with Toggle */}
          <button
            onClick={() => setShiftLimitsOpen(!shiftLimitsOpen)}
            className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <span className="text-xl">👥</span>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">Limiti Personale per Turno</h3>
                <p className="text-xs text-gray-500">Configura il personale richiesto per ogni turno e ruolo</p>
              </div>
            </div>
            {shiftLimitsOpen ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {shiftLimitsOpen && (
            <div className="border-t border-gray-200">
              <div className="px-6 py-5 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1"></div>
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
          )}
        </div>

        {/* Start Times Configuration - Collapsible */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setStartTimesOpen(!startTimesOpen)}
            className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <span className="text-xl">⏰</span>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">Orari di Inizio per Turno</h3>
                <p className="text-xs text-gray-500">Distribuisci il personale su orari diversi</p>
              </div>
            </div>
            {startTimesOpen ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {startTimesOpen && (
            <div className="border-t border-gray-200">
              <div className="px-6 py-5 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1"></div>
                  <Button
                    onClick={saveDistributions}
                    isLoading={savingDistributions}
                    className="bg-orange-600 hover:bg-orange-700"
                    leftIcon={!savingDistributions ? <CheckIcon className="w-4 h-4" /> : undefined}
                  >
                    💾 Salva Tutti gli Orari
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

              {/* Table for each day */}
              <div className="divide-y divide-gray-100">
                {days.map((day, dayIndex) => {
                  const hasRequirements = roles.some(role => getRequiredStaff(dayIndex, selectedShift, role) > 0)
                  
                  if (!hasRequirements) {
                    return (
                      <div key={dayIndex} className="p-6 bg-gray-50">
                        <div className="flex items-center gap-3">
                          <h4 className="text-sm font-semibold text-gray-900">{day}</h4>
                          <span className="text-xs text-gray-500 italic">Nessun personale richiesto per questo turno</span>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={dayIndex} className="p-6 hover:bg-gray-50 transition-colors">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4">{day}</h4>
                      
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                                Orario
                              </th>
                              {roles.map(role => {
                                const required = getRequiredStaff(dayIndex, selectedShift, role)
                                if (required === 0) return null
                                
                                const distributed = getDistributedCount(dayIndex, selectedShift, role)
                                const isComplete = distributed === required
                                const isOver = distributed > required
                                
                                return (
                                  <th key={role} className="px-4 py-3 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-xs font-semibold text-gray-600 uppercase">{roleLabels[role]}</span>
                                      <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                        isOver ? 'bg-red-100 text-red-700' :
                                        isComplete ? 'bg-green-100 text-green-700' : 
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {distributed}/{required}
                                      </div>
                                    </div>
                                  </th>
                                )
                              })}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {Array.from(new Set(
                              roles.flatMap(role => getAvailableStartTimes(selectedShift, role))
                            )).sort().map(startTime => (
                              <tr key={startTime} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                                    {startTime}
                                  </span>
                                </td>
                                {roles.map(role => {
                                  const required = getRequiredStaff(dayIndex, selectedShift, role)
                                  if (required === 0) return null
                                  
                                  const availableTimes = getAvailableStartTimes(selectedShift, role)
                                  const isAvailable = availableTimes.includes(startTime)
                                  const value = getTargetCount(dayIndex, selectedShift, role, startTime)
                                  const distributed = getDistributedCount(dayIndex, selectedShift, role)
                                  const remaining = Math.max(0, required - distributed)
                                  
                                  return (
                                    <td key={role} className="px-4 py-3 whitespace-nowrap">
                                      {isAvailable ? (
                                        <div className="flex justify-center">
                                          <input
                                            type="number"
                                            min="0"
                                            max={value + remaining}
                                            value={value}
                                            onChange={(e) => updateDistribution(
                                              dayIndex,
                                              selectedShift,
                                              role,
                                              startTime,
                                              parseInt(e.target.value) || 0
                                            )}
                                            className="w-16 h-10 text-center text-sm font-semibold border-2 border-gray-200 rounded-lg hover:border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all"
                                            placeholder="0"
                                          />
                                        </div>
                                      ) : (
                                        <div className="flex justify-center">
                                          <span className="text-gray-300">—</span>
                                        </div>
                                      )}
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer Info */}
              <div className="px-6 py-4 bg-purple-50 border-t border-purple-100">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="text-lg">💡</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-semibold text-purple-900 mb-2">Come funziona:</h4>
                    <ul className="text-xs text-purple-800 space-y-1">
                      <li>• <strong>Badge Colorato:</strong> Verde = completato, Giallo = mancanti, Rosso = troppi</li>
                      <li>• <strong>Distribuzione:</strong> La somma degli orari deve essere uguale al personale richiesto</li>
                      <li>• <strong>Limiti:</strong> Configurati in Limiti Personale per Turno (sopra)</li>
                      <li>• <strong>Orari Disponibili:</strong> Variano per ruolo (es. Fattorino CENA: 18:00, 18:30, 19:00)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <ToastContainer />
    </MainLayout>
  )
}
