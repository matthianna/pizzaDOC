'use client'

import { useEffect, useState } from 'react'
import { getDayName } from '@/lib/utils'

const STATUS_LINES = [
  'Disposizione turni…',
  'Copertura forno e cucina…',
  'Bilanciamento carico…',
  'Affinamento orari…',
]

const ROLE_TINTS = [
  'var(--pd-accent)',
  'var(--pd-success)',
  'var(--pd-warning)',
  'color-mix(in srgb, var(--pd-accent) 70%, var(--pd-text))',
]

interface ScheduleGenerateAnimationProps {
  active: boolean
  algorithmLabel?: string
}

export function ScheduleGenerateAnimation({
  active,
  algorithmLabel,
}: ScheduleGenerateAnimationProps) {
  const [statusIndex, setStatusIndex] = useState(0)
  const [fillStep, setFillStep] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!active) {
      setStatusIndex(0)
      setFillStep(0)
      return
    }
    if (reducedMotion) return

    const statusTimer = window.setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_LINES.length)
    }, 1200)

    const fillTimer = window.setInterval(() => {
      setFillStep((s) => (s + 1) % 14)
    }, 220)

    return () => {
      window.clearInterval(statusTimer)
      window.clearInterval(fillTimer)
    }
  }, [active, reducedMotion])

  if (!active) return null

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center px-4"
      style={{
        background: 'color-mix(in srgb, var(--pd-surface) 88%, transparent)',
        backdropFilter: reducedMotion ? undefined : 'blur(2px)',
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <style>{`
        @keyframes pd-ghost-chip-in {
          from { opacity: 0; transform: translateY(4px) scale(0.92); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pd-schedule-row-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="w-full max-w-2xl p-5"
        style={{
          background: 'var(--pd-surface)',
          border: '1px solid var(--pd-border)',
          borderRadius: 'var(--pd-radius-lg)',
          boxShadow: 'var(--pd-shadow)',
        }}
      >
        <p className="text-sm font-semibold text-center" style={{ color: 'var(--pd-text)' }}>
          Generazione piano in corso
        </p>
        {algorithmLabel && (
          <p className="text-xs text-center mt-1" style={{ color: 'var(--pd-muted)' }}>
            Algoritmo {algorithmLabel}
          </p>
        )}
        <p
          className="text-xs text-center mt-2 tabular-nums"
          style={{ color: 'var(--pd-muted)', minHeight: '1rem' }}
        >
          {reducedMotion ? 'Attendere…' : STATUS_LINES[statusIndex]}
        </p>

        {reducedMotion ? (
          <div className="flex justify-center mt-6">
            <div
              className="h-8 w-8 rounded-full border-2 animate-spin"
              style={{
                borderColor: 'var(--pd-border)',
                borderTopColor: 'var(--pd-accent)',
              }}
            />
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, day) => {
              const pranzoFilled = fillStep >= day
              const cenaFilled = fillStep >= day + 7
              return (
                <div key={day} className="flex flex-col gap-1.5 min-w-0">
                  <p
                    className="text-[10px] font-semibold text-center truncate"
                    style={{ color: 'var(--pd-muted)' }}
                  >
                    {getDayName(day).slice(0, 3)}
                  </p>
                  <GhostSlot filled={pranzoFilled} tint={ROLE_TINTS[day % ROLE_TINTS.length]} label="P" />
                  <GhostSlot filled={cenaFilled} tint={ROLE_TINTS[(day + 1) % ROLE_TINTS.length]} label="C" />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function GhostSlot({
  filled,
  tint,
  label,
}: {
  filled: boolean
  tint: string
  label: string
}) {
  return (
    <div
      className="h-8 flex items-center justify-center gap-0.5 px-1"
      style={{
        background: 'var(--pd-surface-muted)',
        borderRadius: 'var(--pd-radius-sm)',
        border: '1px solid var(--pd-border)',
      }}
    >
      {filled ? (
        <>
          <span
            className="block h-2 w-2 rounded-sm"
            style={{
              background: tint,
              animation: 'pd-ghost-chip-in 280ms ease-out',
            }}
          />
          <span
            className="block h-2 w-3 rounded-sm opacity-70"
            style={{
              background: tint,
              animation: 'pd-ghost-chip-in 280ms ease-out 40ms both',
            }}
          />
        </>
      ) : (
        <span className="text-[9px] font-medium" style={{ color: 'var(--pd-muted)' }}>
          {label}
        </span>
      )}
    </div>
  )
}

export function scheduleRevealDelayMs(dayOfWeek: number, shiftType: 'PRANZO' | 'CENA'): number {
  return dayOfWeek * 90 + (shiftType === 'CENA' ? 45 : 0)
}

export const SCHEDULE_REVEAL_TOTAL_MS = 7 * 90 + 45 + 200
