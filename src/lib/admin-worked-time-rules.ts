import { ShiftType } from '@prisma/client'

/** Tutti gli orari ammessi (griglia 30 min) per inizio/fine effettivi */
const ADMIN_WORKED_ALL_SLOTS: Record<ShiftType, readonly string[]> = {
  PRANZO: ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30'],
  CENA: ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00'],
}

/**
 * Solo partenze per cui esiste almeno una fine nella griglia (esclude ultimo slot).
 */
export const ADMIN_WORKED_START_SLOTS: Record<ShiftType, readonly string[]> = {
  PRANZO: ['10:30', '11:00', '11:30', '12:00', '12:30', '13:00'],
  CENA: ['16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'],
}

export function adminWorkedSelectOptions(
  slots: readonly string[]
): { value: string; label: string }[] {
  return slots.map((value) => ({ value, label: value }))
}

function parseHm(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h > 23 || min > 59 || min % 30 !== 0) return null
  return h * 60 + min
}

export function allowedEndSlotsAfterStart(
  shiftType: ShiftType,
  startTime: string
): string[] {
  const slots = ADMIN_WORKED_ALL_SLOTS[shiftType]
  const startM = parseHm(startTime)
  if (startM === null) return []
  return slots.filter((slot) => {
    const m = parseHm(slot)
    return m !== null && m > startM
  })
}

export type AdminWorkedValidation =
  | { ok: true; totalHours: number }
  | { ok: false; error: string }

export function validateAdminWorkedTimes(
  shiftType: ShiftType,
  startTime: string,
  endTime: string
): AdminWorkedValidation {
  const allowedStarts = ADMIN_WORKED_START_SLOTS[shiftType]
  const allowedEnds = ADMIN_WORKED_ALL_SLOTS[shiftType]

  if (!allowedStarts.includes(startTime)) {
    const grid = `${allowedStarts[0]}–${allowedEnds[allowedEnds.length - 1]} (ogni 30 min)`
    return {
      ok: false,
      error:
        shiftType === 'PRANZO'
          ? `Per il pranzo scegli l'inizio tra gli slot ${grid}.`
          : `Per la cena scegli l'inizio tra gli slot ${grid}.`,
    }
  }

  if (!allowedEnds.includes(endTime)) {
    return {
      ok: false,
      error:
        'La fine turno deve essere uno degli slot consentiti (ogni 30 minuti nella fascia del turno).',
    }
  }

  const sm = parseHm(startTime)
  const em = parseHm(endTime)
  if (sm === null || em === null) {
    return { ok: false, error: 'Formato orario non valido (usa HH:mm).' }
  }
  if (em <= sm) {
    return { ok: false, error: "L'orario di fine deve essere dopo l'inizio." }
  }

  const totalHours = (em - sm) / 60
  return { ok: true, totalHours }
}

/** Allinea valori da DB o pianificazione alla sola griglia admin */
export function pickInitialAdminWorkedTimes(
  shiftType: ShiftType,
  proposedStart: string,
  proposedEnd: string
): { start: string; end: string } {
  const starts = ADMIN_WORKED_START_SLOTS[shiftType]
  const start = starts.includes(proposedStart) ? proposedStart : ''
  if (!start) return { start: '', end: '' }
  const endsOk = allowedEndSlotsAfterStart(shiftType, start)
  const end = endsOk.includes(proposedEnd) ? proposedEnd : endsOk[0] ?? ''
  return { start, end }
}
