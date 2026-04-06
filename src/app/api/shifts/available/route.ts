import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addWeekCalendarDays, appTodayUtcMidnight, shiftCalendarDateUtc, shiftInstantRome } from '@/lib/date-utils'

// GET /api/shifts/available - Get available shifts for user to submit hours
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const todayOps = appTodayUtcMidnight(now)
    const weekUpper = addWeekCalendarDays(todayOps, 6)

    const shifts = await prisma.shifts.findMany({
      where: {
        userId: session.user.id,
        schedules: {
          weekStart: {
            lte: weekUpper,
          },
        },
        worked_hours: null,
      },
      include: {
        schedules: true,
        worked_hours: true,
      },
      orderBy: [
        { schedules: { weekStart: 'desc' } },
        { dayOfWeek: 'asc' },
        { shiftType: 'asc' },
      ],
    })

    const availableShifts = shifts.filter((shift) => {
      const shiftDay = shiftCalendarDateUtc(shift.schedules.weekStart, shift.dayOfWeek)
      const endInst = shiftInstantRome(shiftDay, shift.endTime)
      return endInst.getTime() < Date.now()
    })

    return NextResponse.json(availableShifts)
  } catch (error) {
    console.error('Error fetching available shifts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
