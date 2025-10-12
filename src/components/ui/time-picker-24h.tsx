'use client'

import { useState, useEffect } from 'react'

interface TimePicker24hProps {
  value: string // formato "HH:MM"
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function TimePicker24h({ value, onChange, placeholder, className = '' }: TimePicker24hProps) {
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

  // Generate minutes (00, 05, 10, ..., 55)
  const minutesOptions = Array.from({ length: 12 }, (_, i) => {
    const m = (i * 5).toString().padStart(2, '0')
    return { value: m, label: m }
  })

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Hours Select */}
      <div className="flex-1 relative">
        <select
          value={hours}
          onChange={(e) => handleHoursChange(e.target.value)}
          className="w-full appearance-none bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-2xl px-5 py-4 text-2xl font-bold text-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-400 focus:border-blue-500 transition-all cursor-pointer hover:shadow-lg hover:scale-105 text-center"
          style={{ textAlignLast: 'center' }}
        >
          {hoursOptions.map(option => (
            <option key={option.value} value={option.value} className="text-lg font-semibold">
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="text-xs text-blue-600 font-medium text-center mt-1">Ore</div>
      </div>
      
      {/* Separator */}
      <div className="flex flex-col items-center justify-center -mt-5">
        <span className="text-4xl font-black text-blue-500 animate-pulse">:</span>
      </div>
      
      {/* Minutes Select */}
      <div className="flex-1 relative">
        <select
          value={minutes}
          onChange={(e) => handleMinutesChange(e.target.value)}
          className="w-full appearance-none bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-2xl px-5 py-4 text-2xl font-bold text-purple-900 focus:outline-none focus:ring-4 focus:ring-purple-400 focus:border-purple-500 transition-all cursor-pointer hover:shadow-lg hover:scale-105 text-center"
          style={{ textAlignLast: 'center' }}
        >
          {minutesOptions.map(option => (
            <option key={option.value} value={option.value} className="text-lg font-semibold">
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="text-xs text-purple-600 font-medium text-center mt-1">Minuti</div>
      </div>
    </div>
  )
}

