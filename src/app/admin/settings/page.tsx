'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Cog6ToothIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { Calendar, Check, Plus, Edit, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { cn } from '@/lib/utils'

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

interface StartTimeDistribution {
  id?: string
  dayOfWeek: number
  shiftType: 'PRANZO' | 'CENA'
  role: 'PIZZAIOLO' | 'CUCINA' | 'FATTORINO' | 'SALA'
  startTime: string
  targetCount: number
}

interface Holiday {
  id: string
  date: string
  closureType: 'FULL_DAY' | 'PRANZO_ONLY' | 'CENA_ONLY'
  description: string | null
  createdAt: string
  updatedAt: string
}

type Role = 'PIZZAIOLO' | 'CUCINA' | 'FATTORINO' | 'SALA'

const getClosureTypeName = (type: string) => {
  switch (type) {
    case 'FULL_DAY': return 'Giorno intero'
    case 'PRANZO_ONLY': return 'Solo pranzo'
    case 'CENA_ONLY': return 'Solo cena'
    default: return type
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    scooter_count: '3'
  })
  const [shiftLimits, setShiftLimits] = useState<ShiftLimit[]>([])
  const [distributions, setDistributions] = useState<StartTimeDistribution[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [savingLimits, setSavingLimits] = useState(false)
  const [savingDistributions, setSavingDistributions] = useState(false)
  const [selectedShift, setSelectedShift] = useState<'PRANZO' | 'CENA'>('PRANZO')
  const [shiftLimitsOpen, setShiftLimitsOpen] = useState(false)
  const [startTimesOpen, setStartTimesOpen] = useState(false)
  const [holidaysOpen, setHolidaysOpen] = useState(false)
  const [showHolidayModal, setShowHolidayModal] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | null>(null)
  const [filterYear, setFilterYear] = useState<string>('2025')
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

  useEffect(() => {
    if (holidaysOpen) {
      fetchHolidays()
    }
  }, [filterYear, holidaysOpen])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [settingsResponse, limitsResponse, distributionsResponse, holidaysResponse] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/shift-limits'),
        fetch('/api/admin/start-time-distributions'),
        fetch(`/api/admin/holidays?year=${filterYear}`)
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

      if (distributionsResponse.ok) {
        const distributionsData = await distributionsResponse.json()
        setDistributions(distributionsData)
      }

      if (holidaysResponse.ok) {
        const holidaysData = await holidaysResponse.json()
        setHolidays(holidaysData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHolidays = async () => {
    try {
      const response = await fetch(`/api/admin/holidays?year=${filterYear}`)
      if (response.ok) {
        const data = await response.json()
        setHolidays(data)
      }
    } catch (error) {
      console.error('Error fetching holidays:', error)
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
      const allLimits: ShiftLimit[] = []
      
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        for (const shiftType of ['PRANZO', 'CENA'] as const) {
          for (const role of roles) {
            const value = getShiftLimit(dayIndex, shiftType, role)
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
        await fetchData()
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
    
    const otherDistributions = distributions.filter(d => 
      d.dayOfWeek === dayOfWeek && 
      d.shiftType === shiftType && 
      d.role === role &&
      d.startTime !== startTime
    )
    const otherTotal = otherDistributions.reduce((sum, d) => sum + d.targetCount, 0)
    
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
      const allDistributions: StartTimeDistribution[] = []
      
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        for (const shiftType of ['PRANZO', 'CENA'] as const) {
          for (const role of roles) {
            const availableTimes = getAvailableStartTimes(shiftType, role)
            for (const startTime of availableTimes) {
              const value = getTargetCount(dayIndex, shiftType, role, startTime)
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

  const handleDeleteHoliday = async () => {
    if (!deletingHoliday) return

    try {
      const response = await fetch(`/api/admin/holidays/${deletingHoliday.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        showToast('✅ Giorno festivo eliminato!', 'success')
        setHolidays(holidays.filter(h => h.id !== deletingHoliday.id))
        setShowDeleteConfirm(false)
        setDeletingHoliday(null)
      } else {
        const error = await response.json()
        showToast(error.error || 'Errore durante l\'eliminazione', 'error')
      }
    } catch (error) {
      console.error('Error deleting holiday:', error)
      showToast('Errore durante l\'eliminazione', 'error')
    }
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => 2025 + i) // Start from 2025

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
        {/* Header Premium */}
        <div className="bg-white rounded-[2.5rem] shadow-soft border border-gray-100 p-8">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-xl shadow-orange-100">
              <Cog6ToothIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                Configurazioni Sistema
              </h1>
              <p className="text-gray-500 font-medium mt-1">
                Gestisci le impostazioni generali del sistema
              </p>
            </div>
          </div>
        </div>

        {/* Scooter Configuration */}
        <div className="bg-white rounded-[2.5rem] shadow-soft border border-gray-100 p-8 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl flex items-center justify-center shadow-sm">
                <span className="text-2xl">🛵</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">Scooter Disponibili</h3>
                <p className="text-sm text-gray-500 font-medium mt-0.5">Numero di scooter per le consegne</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="20"
                value={settings.scooter_count}
                onChange={(e) => setSettings({ ...settings, scooter_count: e.target.value })}
                className="w-24 h-12 text-center text-xl font-black border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all"
              />
              <Button
                onClick={() => saveSetting('scooter_count', settings.scooter_count, 'Numero di scooter disponibili')}
                isLoading={saving === 'scooter_count'}
                className="bg-orange-600 hover:bg-orange-700 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-200"
              >
                {saving === 'scooter_count' ? 'Salvataggio...' : 'Salva'}
              </Button>
            </div>
          </div>
        </div>

        {/* Holidays Configuration - Collapsible */}
        <div className="bg-white rounded-[2.5rem] shadow-soft border border-gray-100 overflow-hidden">
          <button
            onClick={() => {
              setHolidaysOpen(!holidaysOpen)
              if (!holidaysOpen) {
                fetchHolidays()
              }
            }}
            className="w-full px-8 py-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl flex items-center justify-center shadow-sm">
                <Calendar className="w-6 h-6 text-red-600" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-gray-900">Giorni di Chiusura</h3>
                <p className="text-sm text-gray-500 font-medium">Gestisci i giorni festivi e le chiusure</p>
              </div>
            </div>
            {holidaysOpen ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {holidaysOpen && (
            <div className="border-t border-gray-100">
              <div className="p-8 space-y-6">
                {/* Year Filter & Add Button */}
                <div className="flex items-center justify-between">
                  <div className="bg-gray-100 p-1 rounded-2xl flex items-center gap-1">
                    {years.map(year => (
                      <button
                        key={year}
                        onClick={() => {
                          setFilterYear(year.toString())
                        }}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-black transition-all",
                          filterYear === year.toString()
                            ? "bg-white text-orange-600 shadow-sm"
                            : "text-gray-400 hover:text-gray-600"
                        )}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setEditingHoliday(null)
                      setShowHolidayModal(true)
                    }}
                    className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 shadow-lg shadow-orange-200 transition-all flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Nuovo Festivo
                  </button>
                </div>

                {/* Holidays Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {holidays.length === 0 ? (
                    <div className="col-span-full bg-gray-50 rounded-3xl border border-dashed border-gray-300 p-20 text-center">
                      <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
                        <Calendar className="h-10 w-10 text-gray-300" />
                      </div>
                      <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Nessun giorno festivo per il {filterYear}</p>
                    </div>
                  ) : (
                    holidays.map((holiday) => (
                      <div key={holiday.id} className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-soft border border-gray-100 p-6 hover:shadow-xl transition-all group relative overflow-hidden">
                        <div className={cn(
                          "absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 transition-transform group-hover:scale-110",
                          holiday.closureType === 'FULL_DAY' ? "bg-red-500" :
                          holiday.closureType === 'PRANZO_ONLY' ? "bg-yellow-500" : "bg-blue-500"
                        )} />
                        
                        <div className="flex justify-between items-start mb-6">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data Festività</p>
                            <h3 className="text-lg font-black text-gray-900 leading-tight">
                              {format(new Date(holiday.date), 'EEEE', { locale: it })}
                              <br />
                              <span className="text-orange-600">{format(new Date(holiday.date), 'd MMMM yyyy', { locale: it })}</span>
                            </h3>
                          </div>
                          <span className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm",
                            holiday.closureType === 'FULL_DAY' ? "bg-red-50 text-red-700 border border-red-100" :
                            holiday.closureType === 'PRANZO_ONLY' ? "bg-yellow-50 text-yellow-700 border border-yellow-100" :
                            "bg-blue-50 text-blue-700 border border-blue-100"
                          )}>
                            {getClosureTypeName(holiday.closureType)}
                          </span>
                        </div>

                        {holiday.description && (
                          <div className="mb-6">
                            <p className="text-xs font-medium text-gray-600 leading-relaxed italic bg-gray-50 p-3 rounded-xl border border-gray-100">
                              &quot;{holiday.description}&quot;
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-4 border-t border-gray-50">
                          <button
                            onClick={() => {
                              setEditingHoliday(holiday)
                              setShowHolidayModal(true)
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Modifica
                          </button>
                          <button
                            onClick={() => {
                              setDeletingHoliday(holiday)
                              setShowDeleteConfirm(true)
                            }}
                            className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                            title="Elimina"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Shift Limits Configuration - Collapsible */}
        <div className="bg-white rounded-[2.5rem] shadow-soft border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShiftLimitsOpen(!shiftLimitsOpen)}
            className="w-full px-8 py-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl flex items-center justify-center shadow-sm">
                <span className="text-2xl">👥</span>
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-gray-900">Limiti Personale per Turno</h3>
                <p className="text-sm text-gray-500 font-medium">Configura il personale richiesto per ogni turno e ruolo</p>
              </div>
            </div>
            {shiftLimitsOpen ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {shiftLimitsOpen && (
            <div className="border-t border-gray-100">
              <div className="px-8 py-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex-1"></div>
                  <Button
                    onClick={saveShiftLimits}
                    isLoading={savingLimits}
                    className="bg-orange-600 hover:bg-orange-700 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-200"
                    leftIcon={!savingLimits ? <Check className="w-4 h-4" /> : undefined}
                  >
                    💾 Salva Tutti i Limiti
                  </Button>
                </div>

                <div className="mt-6 flex items-center justify-center">
                  <div className="inline-flex items-center bg-gray-100 rounded-2xl p-1 gap-1">
                    <button
                      onClick={() => setSelectedShift('PRANZO')}
                      className={cn(
                        "px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200",
                        selectedShift === 'PRANZO'
                          ? "bg-white text-orange-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span>🍕</span>
                        <span>PRANZO</span>
                        <span className="text-xs text-gray-500">11:00-14:00</span>
                      </span>
                    </button>
                    <button
                      onClick={() => setSelectedShift('CENA')}
                      className={cn(
                        "px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200",
                        selectedShift === 'CENA'
                          ? "bg-white text-blue-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      )}
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

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-black text-gray-600 uppercase tracking-wider w-40">
                        Giorno
                      </th>
                      {roles.map(role => (
                        <th key={role} className="px-6 py-4 text-center text-xs font-black text-gray-600 uppercase tracking-wider">
                          {roleLabels[role]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {days.map((day, dayIndex) => (
                      <tr key={dayIndex} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-gray-900">{day}</span>
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
                                  className="w-20 h-12 text-center text-lg font-black border-2 border-gray-200 rounded-xl hover:border-orange-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all"
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

              <div className="px-8 py-6 bg-blue-50 border-t border-blue-100">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="text-lg">💡</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-black text-blue-900 mb-2 uppercase tracking-widest">Come funziona:</h4>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• <strong>Personale Richiesto:</strong> Numero di persone necessarie per quel turno e ruolo</li>
                      <li>• <strong>Valore 0:</strong> Nessun requisito per quella combinazione (verrà ignorata)</li>
                      <li>• <strong>Generazione Automatica:</strong> L&apos;algoritmo userà questi valori per assegnare i turni</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Start Times Configuration - Collapsible */}
        <div className="bg-white rounded-[2.5rem] shadow-soft border border-gray-100 overflow-hidden">
          <button
            onClick={() => setStartTimesOpen(!startTimesOpen)}
            className="w-full px-8 py-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl flex items-center justify-center shadow-sm">
                <span className="text-2xl">⏰</span>
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-gray-900">Orari di Inizio per Turno</h3>
                <p className="text-sm text-gray-500 font-medium">Distribuisci il personale su orari diversi</p>
              </div>
            </div>
            {startTimesOpen ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {startTimesOpen && (
            <div className="border-t border-gray-100">
              <div className="px-8 py-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex-1"></div>
                  <Button
                    onClick={saveDistributions}
                    isLoading={savingDistributions}
                    className="bg-orange-600 hover:bg-orange-700 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-200"
                    leftIcon={!savingDistributions ? <Check className="w-4 h-4" /> : undefined}
                  >
                    💾 Salva Tutti gli Orari
                  </Button>
                </div>

                <div className="mt-6 flex items-center justify-center">
                  <div className="inline-flex items-center bg-gray-100 rounded-2xl p-1 gap-1">
                    <button
                      onClick={() => setSelectedShift('PRANZO')}
                      className={cn(
                        "px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200",
                        selectedShift === 'PRANZO'
                          ? "bg-white text-orange-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span>🍕</span>
                        <span>PRANZO</span>
                        <span className="text-xs text-gray-500">11:00-14:00</span>
                      </span>
                    </button>
                    <button
                      onClick={() => setSelectedShift('CENA')}
                      className={cn(
                        "px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200",
                        selectedShift === 'CENA'
                          ? "bg-white text-blue-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      )}
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

              <div className="divide-y divide-gray-100">
                {days.map((day, dayIndex) => {
                  const hasRequirements = roles.some(role => getRequiredStaff(dayIndex, selectedShift, role) > 0)
                  
                  if (!hasRequirements) {
                    return (
                      <div key={dayIndex} className="p-6 bg-gray-50">
                        <div className="flex items-center gap-3">
                          <h4 className="text-sm font-bold text-gray-900">{day}</h4>
                          <span className="text-xs text-gray-500 italic">Nessun personale richiesto per questo turno</span>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={dayIndex} className="p-6 hover:bg-gray-50 transition-colors">
                      <h4 className="text-sm font-bold text-gray-900 mb-4">{day}</h4>
                      
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="px-4 py-3 text-left text-xs font-black text-gray-600 uppercase">
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
                                      <span className="text-xs font-black text-gray-600 uppercase">{roleLabels[role]}</span>
                                      <div className={cn(
                                        "text-xs font-bold px-2 py-0.5 rounded-full",
                                        isOver ? 'bg-red-100 text-red-700' :
                                        isComplete ? 'bg-green-100 text-green-700' : 
                                        'bg-yellow-100 text-yellow-700'
                                      )}>
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
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-700">
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
                                            className="w-20 h-10 text-center text-sm font-bold border-2 border-gray-200 rounded-xl hover:border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all"
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

              <div className="px-8 py-6 bg-purple-50 border-t border-purple-100">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="text-lg">💡</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-black text-purple-900 mb-2 uppercase tracking-widest">Come funziona:</h4>
                    <ul className="text-xs text-purple-800 space-y-1">
                      <li>• <strong>Badge Colorato:</strong> Verde = completato, Giallo = mancanti, Rosso = troppi</li>
                      <li>• <strong>Distribuzione:</strong> La somma degli orari deve essere uguale al personale richiesto</li>
                      <li>• <strong>Limiti:</strong> Configurati in Limiti Personale per Turno (sopra)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Holiday Form Modal */}
      {showHolidayModal && (
        <HolidayFormModal
          holiday={editingHoliday}
          onClose={() => {
            setShowHolidayModal(false)
            setEditingHoliday(null)
          }}
          onSave={() => {
            setShowHolidayModal(false)
            setEditingHoliday(null)
            fetchHolidays()
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setDeletingHoliday(null)
        }}
        onConfirm={handleDeleteHoliday}
        title="Elimina Giorno Festivo"
        description="Sei sicuro di voler eliminare questo giorno festivo? Gli utenti potranno nuovamente inserire disponibilità per questo giorno."
        confirmPhrase="ELIMINA"
        confirmButtonText="Elimina"
        isDangerous={true}
        metadata={
          deletingHoliday && (
            <div className="text-sm space-y-1">
              <p><strong>Data:</strong> {format(new Date(deletingHoliday.date), 'd MMMM yyyy', { locale: it })}</p>
              <p><strong>Tipo:</strong> {getClosureTypeName(deletingHoliday.closureType)}</p>
              {deletingHoliday.description && (
                <p><strong>Descrizione:</strong> {deletingHoliday.description}</p>
              )}
            </div>
          )
        }
      />

      <ToastContainer />
    </MainLayout>
  )
}

// Holiday Form Modal Component
function HolidayFormModal({
  holiday,
  onClose,
  onSave
}: {
  holiday?: Holiday | null
  onClose: () => void
  onSave: () => void
}) {
  const [formData, setFormData] = useState({
    date: holiday ? holiday.date.split('T')[0] : '',
    closureType: holiday?.closureType || 'FULL_DAY',
    description: holiday?.description || ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = holiday 
        ? `/api/admin/holidays/${holiday.id}`
        : '/api/admin/holidays'
      const method = holiday ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        onSave()
      } else {
        const error = await response.json()
        alert(error.error || 'Errore durante il salvataggio')
      }
    } catch (error) {
      console.error('Error saving holiday:', error)
      alert('Errore durante il salvataggio')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={holiday ? 'Modifica Festivo' : 'Nuova Festività'}
      subtitle={holiday ? 'Aggiorna i dettagli della chiusura' : 'Imposta una nuova data di chiusura'}
      headerIcon={<Calendar className="h-6 w-6" />}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-8 pt-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Data Chiusura</label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-5 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
          />
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Modalità Chiusura</label>
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: 'FULL_DAY', label: 'Giorno Intero', desc: 'Chiuso sia a pranzo che a cena' },
              { id: 'PRANZO_ONLY', label: 'Solo Pranzo', desc: 'Aperto regolarmente a cena' },
              { id: 'CENA_ONLY', label: 'Solo Cena', desc: 'Aperto regolarmente a pranzo' }
            ].map((type) => (
              <label 
                key={type.id} 
                className={cn(
                  "flex items-center justify-between p-4 border-2 rounded-2xl cursor-pointer transition-all",
                  formData.closureType === type.id
                    ? "bg-orange-50 border-orange-500 shadow-sm"
                    : "bg-white border-gray-100 hover:border-gray-200"
                )}
              >
                <div>
                  <p className="text-sm font-black text-gray-900">{type.label}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{type.desc}</p>
                </div>
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                  formData.closureType === type.id ? "bg-orange-500 border-orange-500" : "border-gray-200"
                )}>
                  {formData.closureType === type.id && <Check className="h-3 w-3 text-white stroke-[4]" />}
                </div>
                <input
                  type="radio"
                  name="closureType"
                  className="hidden"
                  checked={formData.closureType === type.id}
                  onChange={() => setFormData({ ...formData, closureType: type.id as any })}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Motivazione (Opzionale)</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            placeholder="Es: Vacanze estive, Manutenzione straordinaria..."
            className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl px-5 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all placeholder-gray-300 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 rounded-2xl transition-all"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-[2] py-4 bg-orange-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-100 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Salvataggio...' : 'Salva Festività'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
