import { prisma } from '@/lib/prisma'
import { addWeekCalendarDays, convertJsDayToOurDay, getWeekStart } from '@/lib/date-utils'

/** Disable availability for each calendar day in an approved absence range. */
export async function clearAvailabilityForAbsenceRange(
  userId: string,
  start: Date,
  end: Date
): Promise<void> {
  let dayToCheck = new Date(start)

  while (dayToCheck <= end) {
    const mondayOfWeek = getWeekStart(dayToCheck)
    const jsDay = dayToCheck.getUTCDay()
    const ourDay = convertJsDayToOurDay(jsDay)

    await prisma.availabilities.updateMany({
      where: {
        userId,
        weekStart: mondayOfWeek,
        dayOfWeek: ourDay,
        isAvailable: true,
      },
      data: {
        isAvailable: false,
      },
    })

    dayToCheck = addWeekCalendarDays(dayToCheck, 1)
  }
}
