import { startOfWeek, isAfter, isBefore } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { getDayName } from '@/lib/utils'
import { normalizeDate } from '@/lib/normalize-date'

/** Fuso operativo del locale (piano turni / disponibilità): stessa chiave settimana ovunque. */
const APP_TIMEZONE = 'Europe/Rome'

const MONTHS_IT = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

const SHORT_DAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export function shortWeekdayItFromDate(date: Date): string {
  return SHORT_DAYS_IT[getDayOfWeek(date)]
}

export function formatMonthYearIt(date: Date): string {
  return `${MONTHS_IT[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

export function formatDayMonthIt(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS_IT[date.getUTCMonth()]}`
}

export function formatDayMonthYearIt(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS_IT[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/**
 * Aggiunge giorni al calendario UTC usato per `weekStart` (stessi numeri Y-M-D di getWeekStart / normalizeDate).
 * Non usare date-fns `addDays` su queste date: nel browser usa il fuso locale e sfasa giorno vs getUTCDay().
 */
export function addWeekCalendarDays(weekStart: Date, days: number): Date {
  return new Date(
    Date.UTC(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth(),
      weekStart.getUTCDate() + days,
      0,
      0,
      0,
      0
    )
  )
}

/** Lunedì (calendario UTC) della settimana operativa che contiene questo giorno UTC. */
export function utcMondayOfWeekContainingCalendarDay(day: Date): Date {
  const n = normalizeDate(day)
  const daysSinceMonday = (n.getUTCDay() + 6) % 7
  return addWeekCalendarDays(n, -daysSinceMonday)
}

/**
 * Data (mezzanotte UTC) del giorno del turno: `weekStart` + `dayOfWeek` (0 = lunedì).
 * Allineato a piano turni / `normalizeDate` nel DB.
 */
export function shiftCalendarDateUtc(weekStart: Date | string, dayOfWeek: number): Date {
  const ws = ensureUtcMondayWeekStart(normalizeDate(weekStart))
  return addWeekCalendarDays(ws, dayOfWeek)
}

/**
 * Range di `schedules.weekStart` da interrogare in Prisma per includere ogni settimana
 * che ha almeno un giorno nel mese di calendario UTC (year, month 1–12).
 */
export function utcWeekStartBoundsForCalendarMonth(
  year: number,
  month1to12: number
): { gte: Date; lte: Date } {
  const monthFirst = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0, 0))
  const monthLast = new Date(Date.UTC(year, month1to12, 0, 0, 0, 0, 0))
  return {
    gte: utcMondayOfWeekContainingCalendarDay(monthFirst),
    lte: utcMondayOfWeekContainingCalendarDay(monthLast),
  }
}

export function isUtcCalendarMonth(d: Date, year: number, month1to12: number): boolean {
  return d.getUTCFullYear() === year && d.getUTCMonth() === month1to12 - 1
}

/**
 * Alcuni `schedules.weekStart` nel DB sono salvati come domenica (UTC) mentre le colonne
 * 0–6 sono Lunedì–Domenica operativo. Sposta al lunedì UTC successivo senza cambiare gli indici dei turni.
 */
export function ensureUtcMondayWeekStart(weekStart: Date | string): Date {
  const n = normalizeDate(weekStart)
  if (n.getUTCDay() === 0) {
    return addWeekCalendarDays(n, 1)
  }
  return n
}

/** Sottotitolo settimana tipo "30 marzo — 5 aprile 2026" (solo calendario UTC, ok su Vercel US). */
export function formatUtcWeekSubtitleIt(weekStart: Date, weekEnd: Date): string {
  const y = weekEnd.getUTCFullYear()
  return `${weekStart.getUTCDate()} ${MONTHS_IT[weekStart.getUTCMonth()]} — ${weekEnd.getUTCDate()} ${MONTHS_IT[weekEnd.getUTCMonth()]} ${y}`
}

/** Mese abbreviato (3 lettere) dal calendario UTC. */
export function formatUtcMonthAbbrevIt(date: Date): string {
  return MONTHS_IT[date.getUTCMonth()].slice(0, 3)
}

/** Chiave YYYY-MM-DD del giorno di calendario UTC (allineata a weekStart DB / normalizeDate). */
export function utcCalendarDateKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Oggi nel calendario operativo Europe/Rome, stessa forma YYYY-MM-DD per confronti con utcCalendarDateKey. */
export function appTodayCalendarDateKey(now: Date = new Date()): string {
  const z = new TZDate(now, APP_TIMEZONE)
  const y = z.getFullYear()
  const m = String(z.getMonth() + 1).padStart(2, '0')
  const d = String(z.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Lunedì della settimana in Europe/Rome, espresso come Date UTC a mezzanotte del giorno
 * di calendario del lunedì (coerente con normalizeDate sul server dopo toISOString).
 * Evita che admin in altri fusi vedano settimane / query DB diverse dagli utenti in Italia.
 */
export function getWeekStart(date: Date = new Date()): Date {
  const zoned = new TZDate(date, APP_TIMEZONE)
  const monday = startOfWeek(zoned, { weekStartsOn: 1 })
  return new Date(
    Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0)
  )
}

export function getNextWeekStart(): Date {
  const today = new Date()
  const currentWeekStart = getWeekStart(today)
  return addWeekCalendarDays(currentWeekStart, 7)
}

export function canEditAvailability(weekStart: Date): boolean {
  const today = new Date()
  const currentWeekStart = getWeekStart(today)
  
  // Can only edit future weeks
  return isAfter(weekStart, currentWeekStart) || weekStart.getTime() === currentWeekStart.getTime()
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addWeekCalendarDays(weekStart, i))
}

/** Data di calendario in UTC (allineata a weekStart DB), indipendente dal fuso del browser. */
export function formatDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function formatDateLong(date: Date): string {
  const dw = getDayName(getDayOfWeek(date))
  const d = date.getUTCDate()
  const m = MONTHS_IT[date.getUTCMonth()]
  const y = date.getUTCFullYear()
  return `${dw} ${d} ${m} ${y}`
}

export function getDayOfWeek(date: Date): number {
  // Week boundaries use UTC calendar dates (see getWeekStart / normalizeDate). Local getDay()
  // breaks holiday/availability alignment for users outside the app timezone.
  const jsDay = date.getUTCDay() // 0=Sunday … 6=Saturday for the UTC calendar day
  return jsDay === 0 ? 6 : jsDay - 1 // Our system: Monday=0 … Sunday=6
}

export function convertJsDayToOurDay(jsDay: number): number {
  // Convert JavaScript day (0=Sunday) to our day (0=Monday)
  return jsDay === 0 ? 6 : jsDay - 1
}

export function convertOurDayToJsDay(ourDay: number): number {
  // Convert our day (0=Monday) to JavaScript day (0=Sunday)
  return ourDay === 6 ? 0 : ourDay + 1
}

export function getShiftTimes(shiftType: 'PRANZO' | 'CENA'): { start: string; end: string } {
  return shiftType === 'PRANZO' 
    ? { start: '11:30', end: '14:00' }
    : { start: '18:00', end: '22:00' }
}
