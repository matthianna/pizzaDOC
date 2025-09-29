import { startOfWeek, addDays, format, isAfter, isBefore } from 'date-fns'
import { it } from 'date-fns/locale'

export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 }) // Monday as first day
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
  // Convert to our format: 0 = Monday, 1 = Tuesday, ..., 6 = Sunday
  const jsDay = date.getDay() // JS: 0=Sunday, 1=Monday, ..., 6=Saturday
  return jsDay === 0 ? 6 : jsDay - 1 // Convert: Monday=0, Tuesday=1, ..., Sunday=6
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
