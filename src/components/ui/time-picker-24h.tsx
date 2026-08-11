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
  // Parse initial value
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

  // Generate hours (00-23)
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
    backgroundColor: 'var(--pd-surface)',
    borderColor: 'var(--pd-border-strong)',
    color: 'var(--pd-text)',
    textAlignLast: 'center',
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Hours Select */}
      <div className="flex-1 relative group">
        <div
          className="absolute inset-0 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"
          style={{ background: 'var(--pd-accent-soft)' }}
        />
        <select
          value={hours}
          onChange={(e) => handleHoursChange(e.target.value)}
          className="relative w-full appearance-none border-2 rounded-3xl px-6 py-5 text-3xl font-black focus:outline-none focus:ring-4 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer hover:scale-[1.02] text-center"
          style={{
            ...selectStyle,
            boxShadow: 'var(--pd-shadow)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--pd-accent)'
            e.currentTarget.style.boxShadow = '0 0 0 4px var(--pd-accent-soft)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--pd-border-strong)'
            e.currentTarget.style.boxShadow = 'var(--pd-shadow)'
          }}
        >
          {hoursOptions.map(option => (
            <option
              key={option.value}
              value={option.value}
              className="text-xl font-bold"
              style={{ backgroundColor: 'var(--pd-surface)', color: 'var(--pd-text)' }}
            >
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--pd-accent)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div
          className="text-sm font-bold text-center mt-2 tracking-wide"
          style={{ color: 'var(--pd-muted)' }}
        >
          ORE
        </div>
      </div>
      
      {/* Separator */}
      <div className="flex flex-col items-center justify-center -mt-6">
        <div className="relative">
          <div
            className="absolute inset-0 rounded-full blur-lg opacity-50 animate-pulse"
            style={{ background: 'var(--pd-accent-soft)' }}
          />
          <span
            className="relative text-5xl font-black"
            style={{ color: 'var(--pd-accent)' }}
          >
            :
          </span>
        </div>
      </div>
      
      {/* Minutes Select */}
      <div className="flex-1 relative group">
        <div
          className="absolute inset-0 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"
          style={{ background: 'var(--pd-accent-soft)' }}
        />
        <select
          value={minutes}
          onChange={(e) => handleMinutesChange(e.target.value)}
          className="relative w-full appearance-none border-2 rounded-3xl px-6 py-5 text-3xl font-black focus:outline-none focus:ring-4 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer hover:scale-[1.02] text-center"
          style={{
            ...selectStyle,
            boxShadow: 'var(--pd-shadow)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--pd-accent)'
            e.currentTarget.style.boxShadow = '0 0 0 4px var(--pd-accent-soft)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--pd-border-strong)'
            e.currentTarget.style.boxShadow = 'var(--pd-shadow)'
          }}
        >
          {minutesOptions.map(option => (
            <option
              key={option.value}
              value={option.value}
              className="text-xl font-bold"
              style={{ backgroundColor: 'var(--pd-surface)', color: 'var(--pd-text)' }}
            >
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--pd-accent)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div
          className="text-sm font-bold text-center mt-2 tracking-wide"
          style={{ color: 'var(--pd-muted)' }}
        >
          MINUTI
        </div>
      </div>
    </div>
  )
}
