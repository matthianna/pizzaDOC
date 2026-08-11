'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, Ban, Check } from 'lucide-react'
import { PreviewShell } from '@/components/design-preview/preview-shell'
import { PreviewButton } from '@/components/design-preview/preview-button'
import { cn } from '@/lib/utils'

type ShiftKey = 'PRANZO' | 'CENA'

type DayState = {
  dayOfWeek: number
  label: string
  dateLabel: string
  locked?: boolean
  holiday?: 'FULL' | 'PRANZO' | 'CENA'
  PRANZO: boolean
  CENA: boolean
}

const INITIAL: DayState[] = [
  { dayOfWeek: 1, label: 'Lun', dateLabel: '17 ago', PRANZO: true, CENA: true },
  { dayOfWeek: 2, label: 'Mar', dateLabel: '18 ago', PRANZO: true, CENA: false },
  { dayOfWeek: 3, label: 'Mer', dateLabel: '19 ago', PRANZO: false, CENA: true },
  {
    dayOfWeek: 4,
    label: 'Gio',
    dateLabel: '20 ago',
    holiday: 'PRANZO',
    PRANZO: false,
    CENA: true,
  },
  { dayOfWeek: 5, label: 'Ven', dateLabel: '21 ago', PRANZO: true, CENA: true },
  { dayOfWeek: 6, label: 'Sab', dateLabel: '22 ago', PRANZO: false, CENA: true },
  {
    dayOfWeek: 0,
    label: 'Dom',
    dateLabel: '23 ago',
    holiday: 'FULL',
    locked: true,
    PRANZO: false,
    CENA: false,
  },
]

export function AvailabilityView() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [days, setDays] = useState(INITIAL)
  const [savedFlash, setSavedFlash] = useState(false)

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return 'Prossima settimana'
    if (weekOffset > 0) return `+${weekOffset} sett.`
    return `${weekOffset} sett.`
  }, [weekOffset])

  const toggle = (dayOfWeek: number, shift: ShiftKey) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d
        if (d.locked || d.holiday === 'FULL') return d
        if (d.holiday === shift) return d
        return { ...d, [shift]: !d[shift] }
      })
    )
  }

  const availableCount = days.reduce(
    (acc, d) => acc + (d.PRANZO ? 1 : 0) + (d.CENA ? 1 : 0),
    0
  )

  return (
    <PreviewShell title="Disponibilità" subtitle={weekLabel}>
      <div className="max-w-2xl mx-auto space-y-4 pb-24 lg:pb-0">
        <div
          className="flex items-center justify-between px-2 py-2"
          style={{
            background: 'var(--pd-surface)',
            border: '1px solid var(--pd-border)',
            borderRadius: 'var(--pd-radius-lg)',
          }}
        >
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="p-3 pd-press"
            style={{ color: 'var(--pd-text)', borderRadius: 'var(--pd-radius)' }}
            aria-label="Settimana precedente"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="pd-display text-lg font-semibold leading-tight">{weekLabel}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--pd-muted)' }}>
              17 – 23 agosto · {availableCount} slot disponibili
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="p-3 pd-press"
            style={{ color: 'var(--pd-text)', borderRadius: 'var(--pd-radius)' }}
            aria-label="Settimana successiva"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm px-1" style={{ color: 'var(--pd-muted)' }}>
          Tocca Pranzo o Cena per indicare quando sei disponibile.
        </p>

        <ul className="space-y-2">
          {days.map((day) => {
            const closedFull = day.holiday === 'FULL' || day.locked
            return (
              <li
                key={day.dayOfWeek}
                className="p-3 sm:p-4"
                style={{
                  background: 'var(--pd-surface)',
                  border: '1px solid var(--pd-border)',
                  borderRadius: 'var(--pd-radius-lg)',
                  opacity: closedFull ? 0.72 : 1,
                }}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {day.label}{' '}
                      <span style={{ color: 'var(--pd-muted)' }} className="font-medium">
                        {day.dateLabel}
                      </span>
                    </p>
                    {day.holiday === 'FULL' && (
                      <p
                        className="text-[11px] font-semibold mt-0.5 inline-flex items-center gap-1"
                        style={{ color: 'var(--pd-warning)' }}
                      >
                        <Ban className="h-3 w-3" />
                        Chiusura totale
                      </p>
                    )}
                    {day.holiday === 'PRANZO' && (
                      <p
                        className="text-[11px] font-medium mt-0.5"
                        style={{ color: 'var(--pd-warning)' }}
                      >
                        Pranzo chiuso
                      </p>
                    )}
                  </div>
                  {day.locked && (
                    <Lock className="h-4 w-4 shrink-0" style={{ color: 'var(--pd-muted)' }} />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ShiftToggle
                    label="Pranzo"
                    active={day.PRANZO}
                    disabled={closedFull || day.holiday === 'PRANZO'}
                    onClick={() => toggle(day.dayOfWeek, 'PRANZO')}
                  />
                  <ShiftToggle
                    label="Cena"
                    active={day.CENA}
                    disabled={closedFull || day.holiday === 'CENA'}
                    onClick={() => toggle(day.dayOfWeek, 'CENA')}
                  />
                </div>
              </li>
            )
          })}
        </ul>

        <div className="fixed lg:static bottom-20 lg:bottom-auto inset-x-0 lg:inset-auto z-30 px-4 lg:px-0 pb-safe lg:pb-0">
          <div className="max-w-2xl mx-auto">
            <PreviewButton
              className="w-full py-4 shadow-lg"
              onClick={() => {
                setSavedFlash(true)
                window.setTimeout(() => setSavedFlash(false), 1800)
              }}
            >
              {savedFlash ? (
                <>
                  <Check className="h-4 w-4" />
                  Salvato
                </>
              ) : (
                'Salva disponibilità'
              )}
            </PreviewButton>
          </div>
        </div>
      </div>
    </PreviewShell>
  )
}

function ShiftToggle({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'py-3.5 text-sm font-semibold transition-colors pd-press tap-target',
        disabled && 'cursor-not-allowed opacity-50'
      )}
      style={{
        background: active ? 'var(--pd-success-soft)' : 'var(--pd-surface-muted)',
        color: active ? 'var(--pd-success)' : 'var(--pd-muted)',
        border: active
          ? '1.5px solid color-mix(in srgb, var(--pd-success) 45%, transparent)'
          : '1.5px solid transparent',
        borderRadius: 'var(--pd-radius)',
      }}
    >
      {disabled ? label : active ? `${label} · OK` : `${label} · No`}
    </button>
  )
}
