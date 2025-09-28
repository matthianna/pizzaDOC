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
  id: string
  dayOfWeek: number
  shiftType: 'PRANZO' | 'CENA'
  role: 'CUCINA' | 'FATTORINO' | 'SALA'
  minStaff: number
  maxStaff: number
}

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
  const shifts = ['PRANZO', 'CENA']
  const roles = ['CUCINA', 'FATTORINO', 'SALA']

  // Converte l'indice dell'array (0=Lunedì) in dayOfWeek del database (1=Lunedì, 0=Domenica)
  const getDbDayOfWeek = (arrayIndex: number) => {
    return arrayIndex === 6 ? 0 : arrayIndex + 1 // Domenica = 0, altri giorni = arrayIndex + 1
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

  const updateShiftLimit = (dayOfWeek: number, shiftType: string, role: string, field: 'minStaff' | 'maxStaff', value: number) => {
    setShiftLimits(prev => prev.map(limit => {
      if (limit.dayOfWeek === dayOfWeek && limit.shiftType === shiftType && limit.role === role) {
        return { ...limit, [field]: value }
      }
      return limit
    }))
  }

  const getShiftLimit = (dayOfWeek: number, shiftType: string, role: string) => {
    return shiftLimits.find(limit => 
      limit.dayOfWeek === dayOfWeek && 
      limit.shiftType === shiftType && 
      limit.role === role
    ) || { minStaff: 1, maxStaff: 5 }
  }

  const saveShiftLimits = async () => {
    setSavingLimits(true)
    try {
      const response = await fetch('/api/admin/shift-limits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limits: shiftLimits })
      })

      if (response.ok) {
        showToast('Limiti salvati con successo!', 'success')
      } else {
        showToast('Errore durante il salvataggio', 'error')
      }
    } catch (error) {
      console.error('Error saving limits:', error)
      showToast('Errore durante il salvataggio', 'error')
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
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
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
              leftIcon={saving === 'scooter_count' ? undefined : <CheckIcon />}
              size="sm"
            >
              Salva
            </Button>
          </div>
        </div>

        {/* Shift Limits Configuration */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                👥
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Limiti Personale per Turno</h3>
                <p className="text-sm text-gray-600">Configura il numero minimo e massimo di persone per ogni turno e ruolo</p>
              </div>
            </div>
            <Button
              onClick={saveShiftLimits}
              isLoading={savingLimits}
              leftIcon={savingLimits ? undefined : <CheckIcon />}
            >
              Salva Tutti i Limiti
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Giorno</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Turno</th>
                  {roles.map(role => (
                    <th key={role} className="text-center py-3 px-4 font-medium text-gray-900">
                      {role.charAt(0) + role.slice(1).toLowerCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day, dayIndex) => 
                  shifts.map((shift, shiftIndex) => (
                    <tr key={`${dayIndex}-${shift}`} className="border-b border-gray-100 hover:bg-gray-50">
                      {shiftIndex === 0 && (
                        <td rowSpan={2} className="py-3 px-4 font-medium text-gray-900 border-r border-gray-200">
                          {day}
                        </td>
                      )}
                      <td className="py-3 px-4 text-sm font-medium text-gray-700">
                        {shift}
                        <div className="text-xs text-gray-500">
                          {shift === 'PRANZO' ? '11:30-14:00' : '18:00-22:00'}
                        </div>
                      </td>
                      {roles.map(role => {
                        const limit = getShiftLimit(getDbDayOfWeek(dayIndex), shift, role)
                        return (
                          <td key={role} className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <div className="flex flex-col items-center">
                                <label className="text-xs text-gray-500 mb-1">Min</label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="10"
                                  value={limit.minStaff}
                                  onChange={(e) => updateShiftLimit(getDbDayOfWeek(dayIndex), shift, role, 'minStaff', parseInt(e.target.value) || 0)}
                                  className="w-16 text-center"
                                />
                              </div>
                              <div className="flex flex-col items-center">
                                <label className="text-xs text-gray-500 mb-1">Max</label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="10"
                                  value={limit.maxStaff}
                                  onChange={(e) => updateShiftLimit(getDbDayOfWeek(dayIndex), shift, role, 'maxStaff', parseInt(e.target.value) || 0)}
                                  className="w-16 text-center"
                                />
                              </div>
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

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Legenda:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li><strong>Min:</strong> Numero minimo di persone richieste per il turno</li>
              <li><strong>Max:</strong> Numero massimo di persone che possono lavorare nel turno</li>
              <li>L&apos;algoritmo di generazione automatica userà questi limiti per assegnare i turni</li>
            </ul>
          </div>
        </div>
      </div>
      <ToastContainer />
    </MainLayout>
  )
}