'use client'

import { useState, useEffect } from 'react'

interface TimePicker24hProps {
  value: string // formato "HH:MM"
  onChange: (value: string) => void
  className?: string
  /** Incremento minuti (default 5: 00, 05, … 55) */
  minuteStep?: number
}

export function TimePicker24h({
  value,
  onChange,
  className = '',
  minuteStep = 5,
}: TimePicker24hProps) {
  const [hours, setHours] = useState('00')
  const [minutes, setMinutes] = useState('00')

  useEffect(() => {
    if (value && value.includes(':')) {
      const [h, m] = value.split(':')
      setHours(h.padStart(2, '0'))
      setMinutes(m.padStart(2, '0'))
    }
  }, [value])

  const handleHoursChange = (newHours: string) => {
    setHours(newHours)
    onChange(`${newHours}:${minutes}`)
  }

  const handleMinutesChange = (newMinutes: string) => {
    setMinutes(newMinutes)
    onChange(`${hours}:${newMinutes}`)
  }

  const hoursOptions = Array.from({ length: 24 }, (_, i) => {
    const h = i.toString().padStart(2, '0')
    return { value: h, label: h }
  })

  const steps = Math.max(1, Math.min(30, Math.floor(minuteStep)))
  const minutesOptions = Array.from({ length: Math.ceil(60 / steps) }, (_, i) => {
    const m = (i * steps) % 60
    const v = m.toString().padStart(2, '0')
    return { value: v, label: v }
  })

  const selectStyle: React.CSSProperties = {
    backgroundColor: 'var(--pd-surface-muted)',
    borderColor: 'var(--pd-border)',
    color: 'var(--pd-text)',
    borderRadius: 'var(--pd-radius)',
    textAlignLast: 'center',
  }

  return (
    <div className={`flex items-end gap-3 ${className}`}>
      <div className="flex-1">
        <label className="block text-xs font-semibold mb-1.5 text-center" style={{ color: 'var(--pd-muted)' }}>
          Ore
        </label>
        <select
          value={hours}
          onChange={(e) => handleHoursChange(e.target.value)}
          className="w-full appearance-none border px-3 py-3 text-2xl font-semibold tabular-nums focus:outline-none focus:ring-2 cursor-pointer text-center"
          style={selectStyle}
        >
          {hoursOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <span className="pb-3 text-2xl font-semibold" style={{ color: 'var(--pd-muted)' }}>
        :
      </span>

      <div className="flex-1">
        <label className="block text-xs font-semibold mb-1.5 text-center" style={{ color: 'var(--pd-muted)' }}>
          Minuti
        </label>
        <select
          value={minutes}
          onChange={(e) => handleMinutesChange(e.target.value)}
          className="w-full appearance-none border px-3 py-3 text-2xl font-semibold tabular-nums focus:outline-none focus:ring-2 cursor-pointer text-center"
          style={selectStyle}
        >
          {minutesOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
