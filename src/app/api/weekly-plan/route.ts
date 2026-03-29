import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import { addWeekCalendarDays } from '@/lib/date-utils'

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
        const weekEnd = addWeekCalendarDays(weekStart, 6)

        // Trova il piano per questa settimana con TUTTI i turni
        const schedule = await prisma.schedules.findUnique({
            where: { weekStart },
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

        // Carica i giorni festivi
        const holidays = await prisma.holidays.findMany({
            where: {
                date: {
                    gte: weekStart,
                    lte: weekEnd
                }
            }
        })

        return NextResponse.json({
            schedule: schedule || { weekStart, shifts: [] },
            holidays
        })
    } catch (error) {
        console.error('Error fetching weekly plan:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
