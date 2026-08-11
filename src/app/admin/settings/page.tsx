'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/layout/page-header'
import { SectionBlock } from '@/components/ui/section-block'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { Check } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { HolidaysPanel } from '@/components/admin/holidays-panel'

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

type Role = 'PIZZAIOLO' | 'CUCINA' | 'FATTORINO' | 'SALA'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    scooter_count: '3'
  })
  const [shiftLimits, setShiftLimits] = useState<ShiftLimit[]>([])
  const [distributions, setDistributions] = useState<StartTimeDistribution[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [savingLimits, setSavingLimits] = useState(false)
  const [savingDistributions, setSavingDistributions] = useState(false)
  const [selectedShift, setSelectedShift] = useState<'PRANZO' | 'CENA'>('PRANZO')
  const [shiftLimitsOpen, setShiftLimitsOpen] = useState(false)
  const [startTimesOpen, setStartTimesOpen] = useState(false)
  const [holidaysOpen, setHolidaysOpen] = useState(false)
  const { showToast, ToastContainer } = useToast()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#holidays') {
      setHolidaysOpen(true)
    }
  }, [])

  const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
  const roles: Role[] = ['PIZZAIOLO', 'CUCINA', 'FATTORINO', 'SALA']

  const roleLabels: Record<Role, string> = {
    PIZZAIOLO: 'Pizzaiolo',
    CUCINA: 'Cucina',
    FATTORINO: 'Fattorino',
    SALA: 'Sala'
  }

  const getAvailableStartTimes = (shiftType: 'PRANZO' | 'CENA', role: Role): string[] => {
    if (shiftType === 'PRANZO') {
      if (role === 'SALA' || role === 'FATTORINO') {
        return ['11:30', '12:00']
      }
      return ['11:00', '11:30']
    }
    if (role === 'FATTORINO') {
      return ['18:00', '18:30', '19:00']
    }
    if (role === 'SALA') {
      return ['18:00', '18:30']
    }
    return ['17:00', '18:00', '18:30']
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [settingsResponse, limitsResponse, distributionsResponse] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/shift-limits'),
        fetch('/api/admin/start-time-distributions'),
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, description })
      })

      if (response.ok) {
        showToast('Impostazione salvata', 'success')
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
      }
      return [...prev, { dayOfWeek, shiftType, role, requiredStaff: value }]
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
            allLimits.push({
              dayOfWeek: dayIndex,
              shiftType,
              role,
              requiredStaff: getShiftLimit(dayIndex, shiftType, role)
            })
          }
        }
      }

      const response = await fetch('/api/admin/shift-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limits: allLimits })
      })

      if (response.ok) {
        showToast('Limiti salvati', 'success')
        await fetchData()
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

  const getRequiredStaff = (dayOfWeek: number, shiftType: 'PRANZO' | 'CENA', role: Role): number => {
    const limit = shiftLimits.find(l =>
      l.dayOfWeek === dayOfWeek &&
      l.shiftType === shiftType &&
      l.role === role
    )
    return limit?.requiredStaff ?? 0
  }

  const getDistributedCount = (dayOfWeek: number, shiftType: 'PRANZO' | 'CENA', role: Role): number => {
    return distributions
      .filter(d =>
        d.dayOfWeek === dayOfWeek &&
        d.shiftType === shiftType &&
        d.role === role
      )
      .reduce((sum, d) => sum + d.targetCount, 0)
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
    const otherTotal = distributions
      .filter(d =>
        d.dayOfWeek === dayOfWeek &&
        d.shiftType === shiftType &&
        d.role === role &&
        d.startTime !== startTime
      )
      .reduce((sum, d) => sum + d.targetCount, 0)

    if (otherTotal + value > required) {
      showToast(`Non puoi superare ${required} ${roleLabels[role].toLowerCase()}`, 'error')
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
      }
      return [...prev, { dayOfWeek, shiftType, role, startTime, targetCount: value }]
    })
  }

  const saveDistributions = async () => {
    setSavingDistributions(true)
    try {
      const allDistributions: StartTimeDistribution[] = []

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        for (const shiftType of ['PRANZO', 'CENA'] as const) {
          for (const role of roles) {
            for (const startTime of getAvailableStartTimes(shiftType, role)) {
              allDistributions.push({
                dayOfWeek: dayIndex,
                shiftType,
                role,
                startTime,
                targetCount: getTargetCount(dayIndex, shiftType, role, startTime)
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

      if (responses.every(r => r.ok)) {
        showToast('Orari salvati', 'success')
        await fetchData()
      } else {
        showToast('Errore durante il salvataggio', 'error')
      }
    } catch (error) {
      console.error('Error saving distributions:', error)
      showToast('Errore durante il salvataggio', 'error')
    } finally {
      setSavingDistributions(false)
    }
  }

  const shiftTabs = (
    <div
      className="inline-flex p-1 gap-0.5"
      style={{
        background: 'var(--pd-surface-muted)',
        borderRadius: 'var(--pd-radius)',
      }}
    >
      {([
        { id: 'PRANZO' as const, label: 'Pranzo', hint: '11:00–14:00' },
        { id: 'CENA' as const, label: 'Cena', hint: '17:00–22:00' },
      ]).map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setSelectedShift(tab.id)}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors',
            selectedShift === tab.id ? 'shadow-sm' : ''
          )}
          style={{
            borderRadius: 'calc(var(--pd-radius) - 2px)',
            background: selectedShift === tab.id ? 'var(--pd-surface)' : 'transparent',
            color: selectedShift === tab.id ? 'var(--pd-text)' : 'var(--pd-muted)',
          }}
        >
          {tab.label}
          <span className="ml-2 text-xs" style={{ color: 'var(--pd-muted)' }}>{tab.hint}</span>
        </button>
      ))}
    </div>
  )

  if (loading) {
    return (
      <MainLayout adminOnly contentWidth="6xl">
        <div className="pd-page">
          <div className="flex items-center justify-center py-16">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: 'var(--pd-accent)', borderTopColor: 'transparent' }}
            />
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout adminOnly contentWidth="6xl">
      <div className="pd-page">
        <PageHeader
          dense
          title="Configurazioni"
          subtitle="Impostazioni generali, limiti personale e orari di inizio"
        />

        <SectionBlock title="Scooter disponibili" subtitle="Numero di mezzi per le consegne" card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5">
            <p className="text-sm" style={{ color: 'var(--pd-muted)' }}>
              Valore usato per la generazione dei turni fattorino
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="20"
                value={settings.scooter_count}
                onChange={(e) => setSettings({ ...settings, scooter_count: e.target.value })}
                className="w-20 h-10 text-center text-base font-semibold border focus:outline-none focus:ring-2"
                style={{
                  borderColor: 'var(--pd-border)',
                  borderRadius: 'var(--pd-radius)',
                  background: 'var(--pd-surface-muted)',
                  color: 'var(--pd-text)',
                }}
              />
              <button
                type="button"
                onClick={() => saveSetting('scooter_count', settings.scooter_count, 'Numero di scooter disponibili')}
                disabled={saving === 'scooter_count'}
                className="px-4 py-2.5 text-sm pd-btn-primary disabled:opacity-50"
              >
                {saving === 'scooter_count' ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          </div>
        </SectionBlock>

        <SectionBlock card>
          <button
            type="button"
            onClick={() => setHolidaysOpen(!holidaysOpen)}
            className="w-full px-4 sm:px-5 py-4 flex items-center justify-between text-left"
            id="holidays"
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                Giorni di chiusura
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                Festivi e chiusure aziendali
              </p>
            </div>
            {holidaysOpen ? (
              <ChevronUpIcon className="h-5 w-5" style={{ color: 'var(--pd-muted)' }} />
            ) : (
              <ChevronDownIcon className="h-5 w-5" style={{ color: 'var(--pd-muted)' }} />
            )}
          </button>

          {holidaysOpen && (
            <div style={{ borderTop: '1px solid var(--pd-border)' }}>
              <HolidaysPanel />
            </div>
          )}
        </SectionBlock>

        <SectionBlock card>
          <button
            type="button"
            onClick={() => setShiftLimitsOpen(!shiftLimitsOpen)}
            className="w-full px-4 sm:px-5 py-4 flex items-center justify-between text-left"
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                Limiti personale per turno
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                Personale richiesto per giorno, turno e ruolo
              </p>
            </div>
            {shiftLimitsOpen ? (
              <ChevronUpIcon className="h-5 w-5" style={{ color: 'var(--pd-muted)' }} />
            ) : (
              <ChevronDownIcon className="h-5 w-5" style={{ color: 'var(--pd-muted)' }} />
            )}
          </button>

          {shiftLimitsOpen && (
            <div style={{ borderTop: '1px solid var(--pd-border)' }}>
              <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {shiftTabs}
                <button
                  type="button"
                  onClick={saveShiftLimits}
                  disabled={savingLimits}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm pd-btn-primary disabled:opacity-50"
                >
                  {!savingLimits && <Check className="h-4 w-4" />}
                  {savingLimits ? 'Salvataggio…' : 'Salva limiti'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead style={{ background: 'var(--pd-surface-muted)' }}>
                    <tr>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold w-36"
                        style={{ color: 'var(--pd-muted)' }}
                      >
                        Giorno
                      </th>
                      {roles.map(role => (
                        <th
                          key={role}
                          className="px-4 py-3 text-center text-xs font-semibold"
                          style={{ color: 'var(--pd-muted)' }}
                        >
                          {roleLabels[role]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((day, dayIndex) => (
                      <tr key={dayIndex} style={{ borderTop: '1px solid var(--pd-border)' }}>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--pd-text)' }}>
                          {day}
                        </td>
                        {roles.map(role => (
                          <td key={role} className="px-4 py-3">
                            <div className="flex justify-center">
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={getShiftLimit(dayIndex, selectedShift, role)}
                                onChange={(e) =>
                                  updateShiftLimit(
                                    dayIndex,
                                    selectedShift,
                                    role,
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="w-16 h-9 text-center text-sm font-semibold border focus:outline-none focus:ring-2"
                                style={{
                                  borderColor: 'var(--pd-border)',
                                  borderRadius: 'var(--pd-radius)',
                                  background: 'var(--pd-surface-muted)',
                                  color: 'var(--pd-text)',
                                }}
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                className="px-4 sm:px-5 py-4 text-xs space-y-1"
                style={{
                  background: 'var(--pd-surface-muted)',
                  borderTop: '1px solid var(--pd-border)',
                  color: 'var(--pd-muted)',
                }}
              >
                <p>
                  <span className="font-semibold" style={{ color: 'var(--pd-text)' }}>Personale richiesto:</span>{' '}
                  numero di persone necessarie per quel turno e ruolo.
                </p>
                <p>
                  <span className="font-semibold" style={{ color: 'var(--pd-text)' }}>Valore 0:</span>{' '}
                  nessun requisito (verrà ignorato).
                </p>
              </div>
            </div>
          )}
        </SectionBlock>

        <SectionBlock card>
          <button
            type="button"
            onClick={() => setStartTimesOpen(!startTimesOpen)}
            className="w-full px-4 sm:px-5 py-4 flex items-center justify-between text-left"
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--pd-text)' }}>
                Orari di inizio per turno
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
                Distribuisci il personale su orari diversi
              </p>
            </div>
            {startTimesOpen ? (
              <ChevronUpIcon className="h-5 w-5" style={{ color: 'var(--pd-muted)' }} />
            ) : (
              <ChevronDownIcon className="h-5 w-5" style={{ color: 'var(--pd-muted)' }} />
            )}
          </button>

          {startTimesOpen && (
            <div style={{ borderTop: '1px solid var(--pd-border)' }}>
              <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {shiftTabs}
                <button
                  type="button"
                  onClick={saveDistributions}
                  disabled={savingDistributions}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm pd-btn-primary disabled:opacity-50"
                >
                  {!savingDistributions && <Check className="h-4 w-4" />}
                  {savingDistributions ? 'Salvataggio…' : 'Salva orari'}
                </button>
              </div>

              <div>
                {days.map((day, dayIndex) => {
                  const hasRequirements = roles.some(
                    role => getRequiredStaff(dayIndex, selectedShift, role) > 0
                  )

                  if (!hasRequirements) {
                    return (
                      <div
                        key={dayIndex}
                        className="px-4 sm:px-5 py-3 flex items-center gap-3"
                        style={{
                          borderTop: '1px solid var(--pd-border)',
                          background: 'var(--pd-surface-muted)',
                        }}
                      >
                        <span className="text-sm font-medium" style={{ color: 'var(--pd-text)' }}>
                          {day}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--pd-muted)' }}>
                          Nessun personale richiesto
                        </span>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={dayIndex}
                      className="px-4 sm:px-5 py-4"
                      style={{ borderTop: '1px solid var(--pd-border)' }}
                    >
                      <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--pd-text)' }}>
                        {day}
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--pd-border)' }}>
                              <th
                                className="px-3 py-2 text-left text-xs font-semibold"
                                style={{ color: 'var(--pd-muted)' }}
                              >
                                Orario
                              </th>
                              {roles.map(role => {
                                const required = getRequiredStaff(dayIndex, selectedShift, role)
                                if (required === 0) return null
                                const distributed = getDistributedCount(dayIndex, selectedShift, role)
                                const isComplete = distributed === required
                                const isOver = distributed > required
                                return (
                                  <th key={role} className="px-3 py-2 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-xs font-semibold" style={{ color: 'var(--pd-muted)' }}>
                                        {roleLabels[role]}
                                      </span>
                                      <span
                                        className="text-[11px] font-semibold px-2 py-0.5 tabular-nums"
                                        style={{
                                          borderRadius: '999px',
                                          background: isOver
                                            ? 'var(--pd-danger-soft)'
                                            : isComplete
                                              ? 'var(--pd-success-soft)'
                                              : 'var(--pd-warning-soft)',
                                          color: isOver
                                            ? 'var(--pd-danger)'
                                            : isComplete
                                              ? 'var(--pd-success)'
                                              : 'var(--pd-warning)',
                                        }}
                                      >
                                        {distributed}/{required}
                                      </span>
                                    </div>
                                  </th>
                                )
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from(
                              new Set(
                                roles.flatMap(role => getAvailableStartTimes(selectedShift, role))
                              )
                            )
                              .sort()
                              .map(startTime => (
                                <tr key={startTime} style={{ borderTop: '1px solid var(--pd-border)' }}>
                                  <td className="px-3 py-2.5">
                                    <span
                                      className="inline-block px-2.5 py-1 text-sm font-medium tabular-nums"
                                      style={{
                                        background: 'var(--pd-surface-muted)',
                                        borderRadius: 'var(--pd-radius)',
                                        color: 'var(--pd-text)',
                                      }}
                                    >
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
                                      <td key={role} className="px-3 py-2.5">
                                        {isAvailable ? (
                                          <div className="flex justify-center">
                                            <input
                                              type="number"
                                              min="0"
                                              max={value + remaining}
                                              value={value}
                                              onChange={(e) =>
                                                updateDistribution(
                                                  dayIndex,
                                                  selectedShift,
                                                  role,
                                                  startTime,
                                                  parseInt(e.target.value) || 0
                                                )
                                              }
                                              className="w-16 h-9 text-center text-sm font-semibold border focus:outline-none focus:ring-2"
                                              style={{
                                                borderColor: 'var(--pd-border)',
                                                borderRadius: 'var(--pd-radius)',
                                                background: 'var(--pd-surface-muted)',
                                                color: 'var(--pd-text)',
                                              }}
                                            />
                                          </div>
                                        ) : (
                                          <div className="flex justify-center text-sm" style={{ color: 'var(--pd-muted)' }}>
                                            —
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

              <div
                className="px-4 sm:px-5 py-4 text-xs space-y-1"
                style={{
                  background: 'var(--pd-surface-muted)',
                  borderTop: '1px solid var(--pd-border)',
                  color: 'var(--pd-muted)',
                }}
              >
                <p>
                  Verde = completo, giallo = mancanti, rosso = troppi. La somma degli orari deve
                  coincidere con i limiti sopra.
                </p>
              </div>
            </div>
          )}
        </SectionBlock>
      </div>

      <ToastContainer />
    </MainLayout>
  )
}
