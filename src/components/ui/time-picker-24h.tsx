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

  // Generate minutes (00, 30)
  const minutesOptions = [
    { value: '00', label: '00' },
    { value: '30', label: '30' }
  ]

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Hours Select */}
      <div className="flex-1 relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
        <select
          value={hours}
          onChange={(e) => handleHoursChange(e.target.value)}
          className="relative w-full appearance-none bg-gradient-to-br from-white to-indigo-50 border-3 border-indigo-400 rounded-3xl px-6 py-5 text-3xl font-black text-indigo-900 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:border-indigo-600 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer hover:scale-[1.02] text-center"
          style={{ textAlignLast: 'center' }}
        >
          {hoursOptions.map(option => (
            <option key={option.value} value={option.value} className="text-xl font-bold bg-white">
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
          <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="text-sm text-indigo-700 font-bold text-center mt-2 tracking-wide">ORE</div>
      </div>
      
      {/* Separator */}
      <div className="flex flex-col items-center justify-center -mt-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-400 to-purple-600 rounded-full blur-lg opacity-50 animate-pulse"></div>
          <span className="relative text-5xl font-black bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">:</span>
        </div>
      </div>
      
      {/* Minutes Select */}
      <div className="flex-1 relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
        <select
          value={minutes}
          onChange={(e) => handleMinutesChange(e.target.value)}
          className="relative w-full appearance-none bg-gradient-to-br from-white to-pink-50 border-3 border-pink-400 rounded-3xl px-6 py-5 text-3xl font-black text-pink-900 focus:outline-none focus:ring-4 focus:ring-pink-500 focus:border-pink-600 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer hover:scale-[1.02] text-center"
          style={{ textAlignLast: 'center' }}
        >
          {minutesOptions.map(option => (
            <option key={option.value} value={option.value} className="text-xl font-bold bg-white">
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
          <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="text-sm text-pink-700 font-bold text-center mt-2 tracking-wide">MINUTI</div>
      </div>
    </div>
  )
}

