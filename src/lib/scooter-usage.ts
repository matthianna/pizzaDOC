import { isPast } from 'date-fns'
import { Role, ShiftType, TransportType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  addWeekCalendarDays,
  appTodayCalendarDateKey,
  shiftCalendarDateUtc,
  shiftInstantRome,
  utcCalendarDateKey,
} from '@/lib/date-utils'

export type ScooterUser = {
  primaryTransport?: TransportType | null
  user_transports?: { transport: TransportType }[]
}

export type ScooterShift = {
  role: Role
  dayOfWeek: number
  shiftType: ShiftType
}

export function userUsesScooterTransport(user: ScooterUser): boolean {
  if (user.primaryTransport === 'SCOOTER') return true
  return user.user_transports?.some((t) => t.transport === 'SCOOTER') ?? false
}

export function shiftRequiresScooterLog(shift: ScooterShift, user: ScooterUser): boolean {
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

/** Same rules as schedule page: past day, or today after 14:00 PRANZO / 22:00 CENA */
export function isShiftEndedForLog(
  shift: { dayOfWeek: number; shiftType: ShiftType },
  weekStart: Date
): boolean {
  const shiftDate = addWeekCalendarDays(weekStart, shift.dayOfWeek)

  if (utcCalendarDateKey(shiftDate) !== appTodayCalendarDateKey()) {
    return isPast(shiftDate)
  }

  const now = new Date()
  const currentTime = now.getHours()
  return (
    (shift.shiftType === 'PRANZO' && currentTime >= 14) ||
    (shift.shiftType === 'CENA' && currentTime >= 22)
  )
}

/** Stricter: shift end instant in Rome timezone (for missing lists) */
export function isShiftEndedByEndTime(
  shift: { dayOfWeek: number; shiftType: ShiftType; endTime: string },
  weekStart: Date
): boolean {
  const shiftDay = shiftCalendarDateUtc(weekStart, shift.dayOfWeek)
  const endInst = shiftInstantRome(shiftDay, shift.endTime)
  return endInst.getTime() < Date.now()
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
