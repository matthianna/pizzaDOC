import type { ClosureType } from '@prisma/client'
import { addWeekCalendarDays } from '@/lib/date-utils'

/** ISO date key YYYY-MM-DD from a Date stored as UTC calendar midnight. */
export function utcCalendarKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Calendar date (UTC midnight) for availability slot: week Monday + dayOfWeek (0=Mon … 6=Sun). */
export function dateForAvailabilityDay(weekStart: Date, dayOfWeek: number): Date {
  return addWeekCalendarDays(weekStart, dayOfWeek)
}

export function isShiftBlockedByHoliday(
  closureType: ClosureType,
  shiftType: 'PRANZO' | 'CENA'
): boolean {
  if (closureType === 'FULL_DAY') return true
  if (closureType === 'PRANZO_ONLY' && shiftType === 'PRANZO') return true
  if (closureType === 'CENA_ONLY' && shiftType === 'CENA') return true
  return false
}

export function holidayBlocksSlot(
  holidays: Array<{ date: Date; closureType: ClosureType }>,
  slotDateKey: string,
  shiftType: 'PRANZO' | 'CENA'
): boolean {
  return holidays.some(
    (h) =>
      utcCalendarKey(h.date) === slotDateKey &&
      isShiftBlockedByHoliday(h.closureType, shiftType)
  )
}
