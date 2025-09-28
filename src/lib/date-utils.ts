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
  // Convert to our format: 0 = Sunday, 1 = Monday, etc.
  const jsDay = date.getDay()
  return jsDay
}

export function getShiftTimes(shiftType: 'PRANZO' | 'CENA'): { start: string; end: string } {
  return shiftType === 'PRANZO' 
    ? { start: '11:30', end: '14:00' }
    : { start: '18:00', end: '22:00' }
}
