import { isPast } from 'date-fns'
import { Role, ShiftType, TransportType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  addWeekCalendarDays,
  appTodayCalendarDateKey,
  ensureUtcMondayWeekStart,
  shiftCalendarDateUtc,
  shiftInstantRome,
  utcCalendarDateKey,
} from '@/lib/date-utils'
import { isExcludedFromScooterLog } from '@/lib/utils'

export type ScooterUser = {
  username?: string
  primaryTransport?: TransportType | null
  user_transports?: { transport: TransportType }[]
}

export { isExcludedFromScooterLog }

export function getScooterRegistrationStartDateKey(): string {
  return appTodayCalendarDateKey()
}

export type ScooterShift = {
  role: Role
  dayOfWeek: number
  shiftType: ShiftType
  endTime?: string
}

/** Canonical week start for a shift row (always from its schedule, not the UI week picker). */
export function shiftWeekStartFromSchedule(scheduleWeekStart: Date | string): Date {
  return ensureUtcMondayWeekStart(scheduleWeekStart)
}

export function userUsesScooterTransport(user: ScooterUser): boolean {
  if (user.primaryTransport === 'SCOOTER') return true
  return user.user_transports?.some((t) => t.transport === 'SCOOTER') ?? false
}

/** Shift calendar day is on or after the registration start date (today). */
export function isShiftOnOrAfterRegistrationStart(
  shift: { dayOfWeek: number },
  weekStart: Date
): boolean {
  const shiftDateKey = utcCalendarDateKey(shiftCalendarDateUtc(weekStart, shift.dayOfWeek))
  return shiftDateKey >= getScooterRegistrationStartDateKey()
}

export function shiftRequiresScooterLog(
  shift: ScooterShift,
  user: ScooterUser,
  weekStart: Date
): boolean {
  if (isExcludedFromScooterLog(user.username)) return false
  if (!isShiftOnOrAfterRegistrationStart(shift, weekStart)) return false
  return shift.role === 'FATTORINO' && userUsesScooterTransport(user)
}


export async function getMaxScooterCount(): Promise<number> {
  const setting = await prisma.systemSettings.findUnique({
    where: { key: 'scooter_count' },
  })
  const n = parseInt(setting?.value || '4', 10)
  return Number.isFinite(n) && n > 0 ? n : 4
}

export function validateScooterNumber(scooterNumber: number, max: number): string | null {
  if (!Number.isInteger(scooterNumber) || scooterNumber < 1 || scooterNumber > max) {
    return `Seleziona uno scooter da 1 a ${max}`
  }
  return null
}

/** Shift end instant in Rome (uses scheduled endTime). */
export function isShiftEndedByEndTime(
  shift: { dayOfWeek: number; shiftType: ShiftType; endTime: string },
  weekStart: Date
): boolean {
  const shiftDay = shiftCalendarDateUtc(weekStart, shift.dayOfWeek)
  const endInst = shiftInstantRome(shiftDay, shift.endTime)
  return endInst.getTime() < Date.now()
}

/**
 * Turno finito per la registrazione scooter — stessa logica admin e utente (Rome + endTime).
 * Fallback 14:00/22:00 solo se endTime mancante.
 */
export function isShiftEndedForLog(
  shift: { dayOfWeek: number; shiftType: ShiftType; endTime?: string },
  weekStart: Date
): boolean {
  if (shift.endTime) {
    return isShiftEndedByEndTime(
      shift as { dayOfWeek: number; shiftType: ShiftType; endTime: string },
      weekStart
    )
  }

  const shiftDate = addWeekCalendarDays(weekStart, shift.dayOfWeek)
  if (utcCalendarDateKey(shiftDate) !== appTodayCalendarDateKey()) {
    return isPast(shiftDate)
  }

  const currentTime = new Date().getHours()
  return (
    (shift.shiftType === 'PRANZO' && currentTime >= 14) ||
    (shift.shiftType === 'CENA' && currentTime >= 22)
  )
}

/** True when user must still log scooter/auto for this shift. */
export function shiftNeedsScooterRegistrationNow(
  shift: ScooterShift & { dayOfWeek: number; shiftType: ShiftType; endTime?: string },
  user: ScooterUser,
  scheduleWeekStart: Date | string,
  hasUsage: boolean
): boolean {
  const weekStart = shiftWeekStartFromSchedule(scheduleWeekStart)
  return (
    shiftRequiresScooterLog(shift, user, weekStart) &&
    isShiftEndedForLog(shift, weekStart) &&
    !hasUsage
  )
}

export async function checkScooterConflict(
  shiftId: string,
  scheduleId: string,
  dayOfWeek: number,
  shiftType: ShiftType,
  scooterNumber: number
): Promise<string | null> {
  const conflict = await prisma.shift_scooter_usages.findFirst({
    where: {
      usedAuto: false,
      scooterNumber,
      shiftId: { not: shiftId },
      shifts: {
        scheduleId,
        dayOfWeek,
        shiftType,
      },
    },
    include: {
      user: { select: { username: true } },
    },
  })

  if (conflict) {
    return `${conflict.user.username} ha già registrato lo scooter ${scooterNumber} per questo turno`
  }
  return null
}
