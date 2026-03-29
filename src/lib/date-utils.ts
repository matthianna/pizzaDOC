import { startOfWeek, isAfter, isBefore } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { getDayName } from '@/lib/utils'

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
