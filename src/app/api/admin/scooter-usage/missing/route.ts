import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import {
  appTodayUtcMidnight,
  shiftCalendarDateUtc,
  shiftInstantRome,
  ensureUtcMondayWeekStart,
} from '@/lib/date-utils'
import {
  shiftRequiresScooterLog,
  userUsesScooterTransport,
  isExcludedFromScooterLog,
} from '@/lib/scooter-usage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.roles?.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const weekStartParam = request.nextUrl.searchParams.get('weekStart')
    const todayOps = appTodayUtcMidnight()

    let scheduleFilter: { weekStart?: { gte?: Date; lte?: Date; lt?: Date } } = {
      weekStart: { lt: todayOps },
    }

    if (weekStartParam) {
      const weekStart = normalizeDate(weekStartParam)
      const dayMs = 24 * 60 * 60 * 1000
      scheduleFilter = {
        weekStart: {
          gte: normalizeDate(new Date(weekStart.getTime() - dayMs)),
          lte: normalizeDate(new Date(weekStart.getTime() + dayMs)),
        },
      }
    }

    const shifts = await prisma.shifts.findMany({
      where: {
        role: 'FATTORINO',
        shift_scooter_usages: { is: null },
        schedules: scheduleFilter,
        user: { isActive: true },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryTransport: true,
            user_transports: { select: { transport: true } },
          },
        },
        schedules: { select: { weekStart: true } },
      },
    })

    const missing = shifts
      .filter(
        (shift) =>
          !isExcludedFromScooterLog(shift.user.username) &&
          userUsesScooterTransport(shift.user) &&
          shiftRequiresScooterLog(
            shift,
            shift.user,
            ensureUtcMondayWeekStart(shift.schedules.weekStart)
          )
      )
      .map((shift) => {
        const weekStart = ensureUtcMondayWeekStart(shift.schedules.weekStart)
        const shiftDate = shiftCalendarDateUtc(weekStart, shift.dayOfWeek)
        const endInst = shiftInstantRome(shiftDate, shift.endTime)

        return {
          shiftId: shift.id,
          userId: shift.user.id,
          username: shift.user.username,
          weekStart: weekStart.toISOString(),
          dayOfWeek: shift.dayOfWeek,
          shiftType: shift.shiftType,
          startTime: shift.startTime,
          endTime: shift.endTime,
          shiftDate: shiftDate.toISOString(),
          endMs: endInst.getTime(),
        }
      })
      .filter((s) => s.endMs < Date.now())
      .sort((a, b) => b.endMs - a.endMs)

    return NextResponse.json({
      totalMissing: missing.length,
      missing,
    })
  } catch (error) {
    console.error('Error fetching missing scooter usage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
