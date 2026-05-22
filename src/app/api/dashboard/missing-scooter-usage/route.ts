import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getWeekStart,
  addWeekCalendarDays,
  shiftCalendarDateUtc,
  ensureUtcMondayWeekStart,
} from '@/lib/date-utils'
import {
  shiftRequiresScooterLog,
  isShiftEndedForLog,
  userUsesScooterTransport,
} from '@/lib/scooter-usage'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        primaryTransport: true,
        user_transports: { select: { transport: true } },
      },
    })

    if (!user || !userUsesScooterTransport(user)) {
      return NextResponse.json({ missingShifts: [], count: 0 })
    }

    const weekEndUtc = addWeekCalendarDays(getWeekStart(new Date()), 6)

    const shifts = await prisma.shifts.findMany({
      where: {
        userId: session.user.id,
        role: 'FATTORINO',
        schedules: { weekStart: { lte: weekEndUtc } },
        shift_scooter_usages: { is: null },
      },
      include: {
        schedules: { select: { weekStart: true } },
      },
      orderBy: [{ schedules: { weekStart: 'desc' } }, { dayOfWeek: 'desc' }],
    })

    const missingShifts = shifts
      .filter((shift) => {
        const weekStart = ensureUtcMondayWeekStart(shift.schedules.weekStart)
        return (
          shiftRequiresScooterLog(shift, user) &&
          isShiftEndedForLog(shift, weekStart)
        )
      })
      .map((shift) => {
        const weekStart = ensureUtcMondayWeekStart(shift.schedules.weekStart)
        const shiftDate = shiftCalendarDateUtc(weekStart, shift.dayOfWeek)
        return {
          id: shift.id,
          date: shiftDate.toISOString(),
          dayOfWeek: shift.dayOfWeek,
          shiftType: shift.shiftType,
          role: shift.role,
          startTime: shift.startTime,
          endTime: shift.endTime,
        }
      })

    const recentMissing = missingShifts.slice(0, 10)

    return NextResponse.json({
      missingShifts: recentMissing,
      count: missingShifts.length,
    })
  } catch (error) {
    console.error('Error fetching missing scooter usage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
