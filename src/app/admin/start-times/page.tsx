'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { ClockIcon, CheckIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

interface StartTimeDistribution {
  id?: string
  dayOfWeek: number
  shiftType: 'PRANZO' | 'CENA'
  role: 'PIZZAIOLO' | 'CUCINA' | 'FATTORINO' | 'SALA'
  startTime: string
  targetCount: number
}

type Role = 'PIZZAIOLO' | 'CUCINA' | 'FATTORINO' | 'SALA'

export default function StartTimesPage() {
  const [distributions, setDistributions] = useState<StartTimeDistribution[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
    fetchDistributions()
  }, [])

  const fetchDistributions = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/start-time-distributions')
      if (response.ok) {
        const data = await response.json()
        setDistributions(data)
      }
    } catch (error) {
      console.error('Error fetching distributions:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateDistribution = (
    dayOfWeek: number, 
    shiftType: 'PRANZO' | 'CENA', 
    role: Role, 
    startTime: string, 
    value: number
  ) => {
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

  const saveDistributions = async () => {
    setSaving(true)
    try {
      // Filter out entries with 0 count
      const toSave = distributions.filter(d => d.targetCount > 0)
      
      const responses = await Promise.all(
        toSave.map(dist =>
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
        fetchDistributions()
      } else {
        showToast('❌ Errore durante il salvataggio', 'error')
      }
    } catch (error) {
      console.error('Error saving distributions:', error)
      showToast('❌ Errore durante il salvataggio', 'error')
    } finally {
      setSaving(false)
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
              <ClockIcon className="h-7 w-7 text-gray-400" />
              Distribuzione Orari di Inizio
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Configura quanti dipendenti per ruolo devono iniziare a ogni orario
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header with Toggle */}
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                  <span className="text-xl">⏰</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Orari di Inizio per Turno</h3>
                  <p className="text-xs text-gray-500">Distribuisci il personale su orari diversi</p>
                </div>
              </div>

              <Button
                onClick={saveDistributions}
                isLoading={saving}
                className="bg-orange-600 hover:bg-orange-700"
                leftIcon={!saving ? <CheckIcon className="w-4 h-4" /> : undefined}
              >
                💾 Salva Tutti gli Orari
              </Button>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center justify-center">
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
            {days.map((day, dayIndex) => (
              <div key={dayIndex} className="p-6 hover:bg-gray-50 transition-colors">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">{day}</h4>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                          Orario
                        </th>
                        {roles.map(role => (
                          <th key={role} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                            {roleLabels[role]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* Get all unique start times for this shift */}
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
                            const availableTimes = getAvailableStartTimes(selectedShift, role)
                            const isAvailable = availableTimes.includes(startTime)
                            const value = getTargetCount(dayIndex, selectedShift, role, startTime)
                            
                            return (
                              <td key={role} className="px-4 py-3 whitespace-nowrap">
                                {isAvailable ? (
                                  <div className="flex justify-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
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
            ))}
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
                  <li>• <strong>Orari Disponibili:</strong> Variano per ruolo e turno (es. Pizzaiolo PRANZO: 11:00, 11:30)</li>
                  <li>• <strong>Target Count:</strong> Quante persone devono iniziare a quell&apos;orario specifico</li>
                  <li>• <strong>Valore 0:</strong> Nessuna assegnazione per quell&apos;orario (viene ignorato)</li>
                  <li>• <strong>Generazione Automatica:</strong> L&apos;algoritmo userà queste distribuzioni per assegnare gli orari</li>
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

