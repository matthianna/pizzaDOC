import { normalizeDate } from '@/lib/normalize-date'
import { ensureUtcMondayWeekStart } from '@/lib/date-utils'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Tra più righe `schedules` nei candidati ±1 giorno, evita di scegliere una riga vuota
 * quando un'altra riga con lo stesso "lunedì operativo" UTC ha i turni (es. domenica vs lunedì duplicati).
 */
export function resolveScheduleForRequestedWeek<
  T extends { weekStart: Date; shifts: { length: number } },
>(scheduleRows: T[], requestedWeekStart: Date): T | null {
  if (scheduleRows.length === 0) return null

  const req = normalizeDate(requestedWeekStart)
  const reqCanon = ensureUtcMondayWeekStart(req).getTime()

  const scored = scheduleRows.map((row) => {
    const raw = normalizeDate(row.weekStart)
    const canon = ensureUtcMondayWeekStart(raw).getTime()
    return {
      row,
      dist: Math.abs(raw.getTime() - req.getTime()),
      sameCanon: canon === reqCanon,
      n: row.shifts.length,
    }
  })

  const inBand = scored.filter((s) => s.dist <= DAY_MS || s.sameCanon)
  const pool = inBand.length > 0 ? inBand : scored

  pool.sort((a, b) => {
    if (b.n !== a.n) return b.n - a.n
    if (a.sameCanon !== b.sameCanon) return (a.sameCanon ? 0 : 1) - (b.sameCanon ? 0 : 1)
    return a.dist - b.dist
  })

  return pool[0].row
}
