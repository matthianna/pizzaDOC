import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import { addWeekCalendarDays, ensureUtcMondayWeekStart } from '@/lib/date-utils'
import { resolveScheduleForRequestedWeek } from '@/lib/resolve-schedule-for-week'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const weekStartParam = searchParams.get('weekStart')

        if (!weekStartParam) {
            return NextResponse.json({ error: 'Week start parameter is required' }, { status: 400 })
        }

        const weekStart = normalizeDate(weekStartParam)
        const dayMs = 24 * 60 * 60 * 1000
        const weekStartCandidates = [
            normalizeDate(new Date(weekStart.getTime() - dayMs)),
            weekStart,
            normalizeDate(new Date(weekStart.getTime() + dayMs)),
        ]

        const scheduleRows = await prisma.schedules.findMany({
            where: { weekStart: { in: weekStartCandidates } },
            include: {
                shifts: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                primaryRole: true
                            }
                        }
                    },
                    orderBy: [
                        { dayOfWeek: 'asc' },
                        { shiftType: 'asc' },
                        { role: 'asc' },
                        { startTime: 'asc' }
                    ]
                }
            }
        })

        const schedule =
            scheduleRows.length === 0
                ? null
                : resolveScheduleForRequestedWeek(scheduleRows, weekStart)

        const anchor = schedule?.weekStart ?? weekStart
        const displayAnchor = ensureUtcMondayWeekStart(anchor)
        const weekEnd = addWeekCalendarDays(displayAnchor, 6)

        const holidays = await prisma.holidays.findMany({
            where: {
                date: {
                    gte: displayAnchor,
                    lte: weekEnd
                }
            }
        })

        const noStore = {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
        } as const

        const schedulePayload = schedule
            ? { ...schedule, weekStart: displayAnchor }
            : { weekStart: displayAnchor, shifts: [] }

        return NextResponse.json(
            {
                schedule: schedulePayload,
                holidays
            },
            { headers: noStore }
        )
    } catch (error) {
        console.error('Error fetching weekly plan:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
