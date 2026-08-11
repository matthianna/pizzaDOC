'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import { format, parse, isValid, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import 'react-day-picker/style.css'

export type DatePickerProps = {
  /** ISO date `yyyy-MM-dd` (API-compatible) */
  value: string
  onChange: (value: string) => void
  /** Minimum selectable day as `yyyy-MM-dd` */
  min?: string
  /** Maximum selectable day as `yyyy-MM-dd` */
  max?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  id?: string
  name?: string
  className?: string
  /** Show calendar icon inside the trigger (default true) */
  showIcon?: boolean
}

function parseIso(value?: string): Date | undefined {
  if (!value) return undefined
  const d = parse(value, 'yyyy-MM-dd', new Date())
  return isValid(d) ? startOfDay(d) : undefined
}

function toIso(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function formatDisplay(value: string): string {
  const d = parseIso(value)
  if (!d) return ''
  return format(d, 'dd/MM/yyyy', { locale: it })
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  placeholder = 'gg/mm/aaaa',
  id,
  name,
  className,
  showIcon = true,
}: DatePickerProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)

  const selected = parseIso(value)
  const minDate = parseIso(min)
  const maxDate = parseIso(max)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = () => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const popoverWidth = Math.max(rect.width, 300)
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - popoverWidth - 8
    )
    const spaceBelow = window.innerHeight - rect.bottom
    const preferBelow = spaceBelow >= 340
    const top = preferBelow ? rect.bottom + 6 : Math.max(8, rect.top - 6 - 340)
    setCoords({ top, left, width: popoverWidth })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const onScroll = () => updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      if (!required) onChange('')
      return
    }
    onChange(toIso(date))
    setOpen(false)
  }

  return (
    <div className={cn('relative w-full', className)}>
      {/* Hidden input keeps native form validation / required working */}
      <input
        type="text"
        id={inputId}
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        readOnly
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={() => {}}
      />

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${inputId}-calendar`}
        onClick={() => {
          if (disabled) return
          setOpen((v) => !v)
        }}
        className={cn(
          'w-full flex items-center gap-3 border px-4 py-2.5 text-sm font-medium text-left transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-[var(--pd-accent)]',
          disabled && 'opacity-60 cursor-not-allowed'
        )}
        style={{
          background: 'var(--pd-surface-muted)',
          borderColor: 'var(--pd-border)',
          borderRadius: 'var(--pd-radius)',
          color: value ? 'var(--pd-text)' : 'var(--pd-muted)',
        }}
      >
        {showIcon && (
          <Calendar className="h-4 w-4 shrink-0" style={{ color: 'var(--pd-muted)' }} />
        )}
        <span className="flex-1 tabular-nums tracking-wide">
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>

      {mounted &&
        open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            id={`${inputId}-calendar`}
            role="dialog"
            aria-label="Seleziona data"
            className="pd-day-picker fixed z-[100050] p-3 shadow-xl border"
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
              background: 'var(--pd-surface)',
              borderColor: 'var(--pd-border)',
              borderRadius: 'var(--pd-radius-lg)',
              color: 'var(--pd-text)',
              boxShadow: 'var(--pd-shadow)',
            }}
          >
            <DayPicker
              mode="single"
              locale={it}
              weekStartsOn={1}
              selected={selected}
              defaultMonth={selected ?? minDate ?? new Date()}
              onSelect={handleSelect}
              disabled={[
                ...(minDate ? [{ before: minDate }] : []),
                ...(maxDate ? [{ after: maxDate }] : []),
              ]}
              labels={{
                labelMonthDropdown: () => 'Mese',
                labelYearDropdown: () => 'Anno',
                labelNext: () => 'Mese successivo',
                labelPrevious: () => 'Mese precedente',
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: 'var(--pd-border)' }}>
              <button
                type="button"
                className="text-xs font-semibold px-2 py-1.5"
                style={{ color: 'var(--pd-muted)', borderRadius: 'var(--pd-radius-sm)' }}
                onClick={() => {
                  if (!required) onChange('')
                  setOpen(false)
                }}
              >
                Cancella
              </button>
              <button
                type="button"
                className="text-xs font-semibold px-2.5 py-1.5"
                style={{
                  color: 'var(--pd-accent)',
                  background: 'var(--pd-accent-soft)',
                  borderRadius: 'var(--pd-radius-sm)',
                }}
                onClick={() => {
                  const today = startOfDay(new Date())
                  if (minDate && today < minDate) return
                  if (maxDate && today > maxDate) return
                  onChange(toIso(today))
                  setOpen(false)
                }}
              >
                Oggi
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
