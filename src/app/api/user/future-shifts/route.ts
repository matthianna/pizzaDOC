import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addWeekCalendarDays, getWeekStart, shiftCalendarDateUtc, shiftInstantRome } from '@/lib/date-utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Get user's future shifts (not past and not already requested for substitution)
    const fromWeek = addWeekCalendarDays(getWeekStart(now), -7)

    const shifts = await prisma.shifts.findMany({
      where: {
        userId: session.user.id,
        schedules: {
          weekStart: {
            gte: fromWeek,
          },
        },
        NOT: {
          substitutions: {
            some: {
              status: {
                in: ['PENDING', 'APPLIED', 'APPROVED'],
              },
            },
          },
        },
      },
      include: {
        schedules: {
          select: {
            weekStart: true,
          },
        },
      },
      orderBy: [
        { schedules: { weekStart: 'asc' } },
        { dayOfWeek: 'asc' },
        { shiftType: 'asc' },
      ],
    })

    const futureShifts = shifts.filter((shift) => {
      const shiftDay = shiftCalendarDateUtc(shift.schedules.weekStart, shift.dayOfWeek)
      const startInst = shiftInstantRome(shiftDay, shift.startTime)
      return startInst.getTime() > Date.now()
    })

    return NextResponse.json(futureShifts)
  } catch (error) {
    console.error('Error fetching future shifts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
