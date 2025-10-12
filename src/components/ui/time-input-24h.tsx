'use client'

import { useEffect, useRef } from 'react'

interface TimeInput24hProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function TimeInput24h({ value, onChange, className = '', ...props }: TimeInput24hProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Force 24-hour format when component mounts or value changes
    if (inputRef.current) {
      const input = inputRef.current
      
      // Remove any AM/PM formatting
      const style = document.createElement('style')
      style.textContent = `
        input[type="time"]::-webkit-datetime-edit-ampm-field {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
          opacity: 0 !important;
        }
      `
      document.head.appendChild(style)
      
      // Set attributes to force 24-hour
      input.setAttribute('data-time-format', '24')
      
      // Trigger re-render
      setTimeout(() => {
        const currentValue = input.value
        input.value = ''
        input.value = currentValue
      }, 0)
      
      return () => {
        document.head.removeChild(style)
      }
    }
  }, [value])

  return (
    <input
      ref={inputRef}
      type="time"
      value={value}
      onChange={onChange}
      step="60"
      pattern="[0-9]{2}:[0-9]{2}"
      lang="it-IT"
      data-time-format="24"
      className={className}
      style={{ 
        colorScheme: 'light',
        WebkitAppearance: 'none',
        MozAppearance: 'textfield'
      }}
      {...props}
    />
  )
}

