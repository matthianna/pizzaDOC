import { ShiftType } from '@prisma/client'

/** Incremento minuti per inizio/fine effettivi (admin) */
export const ADMIN_WORKED_STEP_MINUTES = 5

type ShiftBounds = {
  startMin: number
  startMax: number
  endMin: number
  endMax: number
}

const BOUNDS: Record<ShiftType, ShiftBounds> = {
  PRANZO: {
    startMin: 10 * 60 + 30,
    startMax: 13 * 60,
    endMin: 12 * 60,
    endMax: 14 * 60 + 30,
  },
  CENA: {
    startMin: 16 * 60 + 30,
    startMax: 19 * 60 + 30,
    endMin: 19 * 60,
    endMax: 23 * 60,
  },
}

export function formatAdminWorkedHm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function snapToStep(mins: number): number {
  const s = ADMIN_WORKED_STEP_MINUTES
  return Math.round(mins / s) * s
}

/** Parsing senza vincolo sulla griglia (es. valori legacy dal DB) */
export function parseAdminWorkedHmLoose(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function parseAdminWorkedHmStrict(t: string): number | null {
  const mins = parseAdminWorkedHmLoose(t)
  if (mins === null) return null
  if (mins % ADMIN_WORKED_STEP_MINUTES !== 0) return null
  return mins
}

/** Opzioni HH:mm (24h) ammesse per inizio o fine turno, griglia 5 min. Per la fine, opzionale `endMustBeAfterMinutes` (minuti da mezzanotte) per avere solo orari dopo l'inizio. */
export function adminWorkedTimeOptions(
  shiftType: ShiftType,
  field: 'start' | 'end',
  endMustBeAfterMinutes?: number | null
): string[] {
  const b = BOUNDS[shiftType]
  let lo = field === 'start' ? b.startMin : b.endMin
  const hi = field === 'start' ? b.startMax : b.endMax

  if (
    field === 'end' &&
    endMustBeAfterMinutes != null &&
    Number.isFinite(endMustBeAfterMinutes)
  ) {
    lo = Math.max(lo, endMustBeAfterMinutes + ADMIN_WORKED_STEP_MINUTES)
    const r = lo % ADMIN_WORKED_STEP_MINUTES
    if (r !== 0) lo += ADMIN_WORKED_STEP_MINUTES - r
  }

  const out: string[] = []
  for (let m = lo; m <= hi; m += ADMIN_WORKED_STEP_MINUTES) {
    out.push(formatAdminWorkedHm(m))
  }
  return out
}

/** Min / max per testi di aiuto (es. fascia consentita) */
export function adminWorkedNativeTimeBounds(
  shiftType: ShiftType,
  field: 'start' | 'end'
): { min: string; max: string } {
  const b = BOUNDS[shiftType]
  if (field === 'start') {
    return { min: formatAdminWorkedHm(b.startMin), max: formatAdminWorkedHm(b.startMax) }
  }
  return { min: formatAdminWorkedHm(b.endMin), max: formatAdminWorkedHm(b.endMax) }
}

export type AdminWorkedValidation =
  | { ok: true; totalHours: number }
  | { ok: false; error: string }

export function validateAdminWorkedTimes(
  shiftType: ShiftType,
  startTime: string,
  endTime: string
): AdminWorkedValidation {
  const b = BOUNDS[shiftType]
  const sm = parseAdminWorkedHmStrict(startTime)
  const em = parseAdminWorkedHmStrict(endTime)

  if (sm === null || em === null) {
    return {
      ok: false,
      error: `Usa orari HH:mm con incrementi di ${ADMIN_WORKED_STEP_MINUTES} minuti (es. 18:05, 18:10).`,
    }
  }

  if (sm < b.startMin || sm > b.startMax) {
    return {
      ok: false,
      error:
        shiftType === 'PRANZO'
          ? `Per il pranzo l'inizio deve essere tra ${formatAdminWorkedHm(b.startMin)} e ${formatAdminWorkedHm(b.startMax)}.`
          : `Per la cena l'inizio deve essere tra ${formatAdminWorkedHm(b.startMin)} e ${formatAdminWorkedHm(b.startMax)}.`,
    }
  }

  if (em < b.endMin || em > b.endMax) {
    return {
      ok: false,
      error: `La fine deve essere tra ${formatAdminWorkedHm(b.endMin)} e ${formatAdminWorkedHm(b.endMax)}.`,
    }
  }

  if (em <= sm) {
    return { ok: false, error: "L'orario di fine deve essere dopo l'inizio." }
  }

  const totalHours = (em - sm) / 60
  return { ok: true, totalHours }
}

/**
 * Normalizza valori da DB o pianificazione rispetto a fascia turno e griglia 5 min.
 */
export function pickInitialAdminWorkedTimes(
  shiftType: ShiftType,
  proposedStart: string,
  proposedEnd: string
): { start: string; end: string } {
  const b = BOUNDS[shiftType]
  let sm = parseAdminWorkedHmLoose(proposedStart)
  let em = parseAdminWorkedHmLoose(proposedEnd)

  if (sm !== null) sm = snapToStep(sm)
  if (em !== null) em = snapToStep(em)

  if (sm === null) sm = b.startMin
  sm = clamp(sm, b.startMin, b.startMax)

  if (em === null) {
    em = sm + ADMIN_WORKED_STEP_MINUTES
  }
  em = clamp(em, b.endMin, b.endMax)

  if (em <= sm) {
    em = Math.min(b.endMax, sm + ADMIN_WORKED_STEP_MINUTES)
  }
  if (em <= sm) {
    sm = Math.max(b.startMin, em - ADMIN_WORKED_STEP_MINUTES)
  }

  if (em <= sm) {
    sm = b.startMin
    em = clamp(sm + ADMIN_WORKED_STEP_MINUTES, b.endMin, b.endMax)
  }

  if (em > b.endMax) em = b.endMax
  if (em < b.endMin) em = b.endMin
  if (sm < b.startMin) sm = b.startMin
  if (sm > b.startMax) sm = b.startMax

  if (em <= sm) {
    em = Math.min(b.endMax, sm + ADMIN_WORKED_STEP_MINUTES)
  }

  return { start: formatAdminWorkedHm(sm), end: formatAdminWorkedHm(em) }
}
