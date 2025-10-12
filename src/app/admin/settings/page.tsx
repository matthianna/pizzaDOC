'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Cog6ToothIcon, CheckIcon } from '@heroicons/react/24/outline'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

interface Settings {
  scooter_count: string
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
  const [shiftLimits, setShiftLimits] = useState<ShiftLimit[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [savingLimits, setSavingLimits] = useState(false)
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

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [settingsResponse, limitsResponse] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/shift-limits')
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
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
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
