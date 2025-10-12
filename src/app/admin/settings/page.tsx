'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Cog6ToothIcon, CheckIcon, UsersIcon } from '@heroicons/react/24/outline'
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
  const { showToast, ToastContainer } = useToast()

  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
  const shifts: ('PRANZO' | 'CENA')[] = ['PRANZO', 'CENA']
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
        showToast('Impostazione salvata!', 'success')
      } else {
        showToast('Errore durante il salvataggio', 'error')
      }
    } catch (error) {
      console.error('Error saving setting:', error)
      showToast('Errore durante il salvataggio', 'error')
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
      // Filter out entries with 0 required staff (no need to save them)
      const limitsToSave = shiftLimits.filter(l => l.requiredStaff > 0)
      
      const response = await fetch('/api/admin/shift-limits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limits: limitsToSave })
      })

      if (response.ok) {
        showToast('✅ Limiti salvati con successo!', 'success')
        fetchData() // Refresh data
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
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Cog6ToothIcon className="h-8 w-8 mr-3 text-orange-600" />
            Configurazioni Sistema
          </h1>
          <p className="text-gray-600 mt-1">
            Gestisci le impostazioni generali del sistema
          </p>
        </div>

        {/* Scooter Configuration */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
              🛵
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Scooter Disponibili</h3>
              <p className="text-sm text-gray-600">Numero di scooter a disposizione per le consegne</p>
            </div>
          </div>

          <div className="flex items-end space-x-3">
            <Input
              type="number"
              label="Numero scooter"
              value={settings.scooter_count}
              onChange={(e) => setSettings({ ...settings, scooter_count: e.target.value })}
              min="1"
              max="20"
              className="flex-1 max-w-xs"
            />
            <Button
              onClick={() => saveSetting('scooter_count', settings.scooter_count, 'Numero di scooter disponibili per le consegne')}
              isLoading={saving === 'scooter_count'}
              leftIcon={saving === 'scooter_count' ? undefined : <CheckIcon className="w-5 h-5" />}
              size="sm"
            >
              Salva
            </Button>
          </div>
        </div>

        {/* Shift Limits Configuration */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <UsersIcon className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Limiti Personale per Turno</h3>
                  <p className="text-sm text-gray-600">Configura il numero minimo e massimo di persone per ogni turno e ruolo</p>
                </div>
              </div>
              <Button
                onClick={saveShiftLimits}
                isLoading={savingLimits}
                className="bg-orange-600 hover:bg-orange-700"
                leftIcon={!savingLimits ? <CheckIcon className="w-5 h-5" /> : undefined}
              >
                💾 Salva Tutti i Limiti
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-32">
                    Giorno
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-40">
                    Turno
                  </th>
                  {roles.map(role => (
                    <th key={role} className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      {roleLabels[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {days.map((day, dayIndex) => 
                  shifts.map((shift, shiftIndex) => (
                    <tr 
                      key={`${dayIndex}-${shift}`} 
                      className={`hover:bg-gray-50 transition-colors ${
                        shiftIndex === 0 ? 'border-t-2 border-gray-300' : ''
                      }`}
                    >
                      {shiftIndex === 0 && (
                        <td 
                          rowSpan={2} 
                          className="px-4 py-3 font-semibold text-gray-900 border-r-2 border-gray-200 bg-gray-50"
                        >
                          {day}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          shift === 'PRANZO' 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          <span className="mr-2">{shift === 'PRANZO' ? '🍕' : '🍝'}</span>
                          {shift}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 ml-1">
                          {shift === 'PRANZO' ? '11:00-14:00' : '17:00-22:00'}
                        </div>
                      </td>
                      {roles.map(role => {
                        const value = getShiftLimit(dayIndex, shift, role)
                        return (
                          <td key={role} className="px-4 py-3">
                            <div className="flex justify-center">
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={value}
                                onChange={(e) => updateShiftLimit(
                                  dayIndex, 
                                  shift, 
                                  role, 
                                  parseInt(e.target.value) || 0
                                )}
                                className="w-16 h-10 text-center text-lg font-semibold border-2 border-gray-300 rounded-lg hover:border-orange-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                                placeholder="0"
                              />
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Info */}
          <div className="px-6 py-4 bg-blue-50 border-t border-blue-200">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-100">
                  <span className="text-xl">💡</span>
                </div>
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Come funziona:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
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
