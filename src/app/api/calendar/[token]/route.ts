import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  buildPersonalCalendarIcs,
  getCalendarFeedWeekRange,
  normalizeCalendarTokenParam,
  type CalendarShiftInput,
} from '@/lib/calendar-ics'
import { ensureUtcMondayWeekStart } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RouteParams = { params: Promise<{ token: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token: rawToken } = await params
    const token = normalizeCalendarTokenParam(rawToken)

    if (!token || token.length < 16) {
      return new NextResponse('Not found', { status: 404 })
    }

    const user = await prisma.user.findFirst({
      where: { calendarToken: token, isActive: true },
      select: { id: true, username: true },
    })

    if (!user) {
      return new NextResponse('Not found', { status: 404 })
    }

    const { fromWeekStart, toWeekStart } = getCalendarFeedWeekRange()

    const shifts = await prisma.shifts.findMany({
      where: {
        userId: user.id,
        status: { not: 'SUBSTITUTED' },
        schedules: {
          weekStart: {
            gte: fromWeekStart,
            lte: toWeekStart,
          },
        },
      },
      select: {
        id: true,
        dayOfWeek: true,
        shiftType: true,
        role: true,
        startTime: true,
        updatedAt: true,
        schedules: { select: { weekStart: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { shiftType: 'asc' }],
    })

    const inputs: CalendarShiftInput[] = shifts.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      shiftType: s.shiftType,
      role: s.role,
      startTime: s.startTime,
      weekStart: ensureUtcMondayWeekStart(s.schedules.weekStart),
      updatedAt: s.updatedAt,
    }))

    const ics = buildPersonalCalendarIcs({
      username: user.username,
      shifts: inputs,
    })

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="pizzadoc-${user.username}.ics"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Error building calendar feed:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
