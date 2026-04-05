import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import {
  addWeekCalendarDays,
  appTodayCalendarDateKey,
  getWeekStart,
  utcCalendarDateKey,
} from '@/lib/date-utils'
import { resolveScheduleForRequestedWeek } from '@/lib/resolve-schedule-for-week'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const todayKey = appTodayCalendarDateKey(now)
    const [ty, tm, td] = todayKey.split('-').map(Number)
    const todayUtc = new Date(Date.UTC(ty, tm - 1, td, 0, 0, 0, 0))

    const currentWeekStart = getWeekStart(now)

    let dayIndex = 0
    for (let i = 0; i < 7; i++) {
      if (utcCalendarDateKey(addWeekCalendarDays(currentWeekStart, i)) === todayKey) {
        dayIndex = i
        break
      }
    }

    const dayMs = 24 * 60 * 60 * 1000
    const weekStartCandidates = [
      normalizeDate(new Date(currentWeekStart.getTime() - dayMs)),
      normalizeDate(currentWeekStart),
      normalizeDate(new Date(currentWeekStart.getTime() + dayMs)),
    ]

    const scheduleRows = await prisma.schedules.findMany({
      where: { weekStart: { in: weekStartCandidates } },
      include: {
        shifts: {
          where: { dayOfWeek: dayIndex },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                primaryRole: true,
                primaryTransport: true,
                user_transports: {
                  select: { transport: true },
                },
              },
            },
          },
          orderBy: [{ shiftType: 'asc' }, { role: 'asc' }],
        },
      },
    })

    const schedule = resolveScheduleForRequestedWeek(scheduleRows, currentWeekStart)
    let rawShifts = schedule?.shifts ?? []

    const holidaysToday = await prisma.holidays.findMany({
      where: {
        date: {
          gte: todayUtc,
          lt: addWeekCalendarDays(todayUtc, 1),
        },
      },
    })

    const isFullClosure = holidaysToday.some((h) => h.closureType === 'FULL_DAY')
    const isPranzoClosed =
      isFullClosure || holidaysToday.some((h) => h.closureType === 'PRANZO_ONLY')
    const isCenaClosed =
      isFullClosure || holidaysToday.some((h) => h.closureType === 'CENA_ONLY')

    rawShifts = rawShifts.filter((s) => {
      if (isPranzoClosed && s.shiftType === 'PRANZO') return false
      if (isCenaClosed && s.shiftType === 'CENA') return false
      return true
    })

    const groupedShifts = rawShifts.reduce(
      (acc, shift) => {
        const key = shift.shiftType
        if (!acc[key]) acc[key] = []
        acc[key].push(shift)
        return acc
      },
      {} as Record<string, typeof rawShifts>
    )

    const holidaysPayload = holidaysToday.map((h) => ({
      id: h.id,
      closureType: h.closureType,
      description: h.description,
    }))

    return NextResponse.json(
      {
        date: todayUtc.toISOString(),
        dayOfWeek: dayIndex,
        todayKey,
        shifts: groupedShifts,
        totalWorkers: rawShifts.length,
        holidays: holidaysPayload,
        isPranzoClosed,
        isCenaClosed,
        isFullClosure,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching today shifts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
