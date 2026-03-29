import { startOfWeek, addDays, format, isAfter, isBefore } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { it } from 'date-fns/locale'

/** Fuso operativo del locale (piano turni / disponibilità): stessa chiave settimana ovunque. */
const APP_TIMEZONE = 'Europe/Rome'

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
  return addDays(currentWeekStart, 7)
}

export function canEditAvailability(weekStart: Date): boolean {
  const today = new Date()
  const currentWeekStart = getWeekStart(today)
  
  // Can only edit future weeks
  return isAfter(weekStart, currentWeekStart) || weekStart.getTime() === currentWeekStart.getTime()
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export function formatDate(date: Date): string {
  return format(date, 'dd/MM/yyyy', { locale: it })
}

export function formatDateLong(date: Date): string {
  return format(date, 'EEEE dd MMMM yyyy', { locale: it })
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
