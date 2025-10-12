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
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        value={hours}
        onChange={(e) => handleHoursChange(e.target.value)}
        className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-center font-medium"
      >
        {hoursOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      <span className="text-2xl font-bold text-gray-500">:</span>
      
      <select
        value={minutes}
        onChange={(e) => handleMinutesChange(e.target.value)}
        className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-center font-medium"
      >
        {minutesOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

