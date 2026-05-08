import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  isUtcCalendarMonth,
  shiftCalendarDateUtc,
  utcWeekStartBoundsForCalendarMonth,
} from '@/lib/date-utils'

// GET /api/hours - Get user's worked hours
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    let dateFilter: Record<string, unknown> = {}
    let yearNum = NaN
    let monthNum = NaN
    if (month && year) {
      yearNum = parseInt(year, 10)
      monthNum = parseInt(month, 10)
      const { gte, lte } = utcWeekStartBoundsForCalendarMonth(yearNum, monthNum)
      dateFilter = {
        shifts: {
          schedules: {
            weekStart: { gte, lte },
          },
        },
      }
    }

    const workedHours = await prisma.worked_hours.findMany({
      where: {
        userId: session.user.id,
        ...dateFilter,
      },
      include: {
        shifts: {
          include: {
            schedules: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    })

    const filtered =
      month && year && Number.isFinite(yearNum) && Number.isFinite(monthNum)
        ? workedHours.filter((wh) =>
            isUtcCalendarMonth(
              shiftCalendarDateUtc(wh.shifts.schedules.weekStart, wh.shifts.dayOfWeek),
              yearNum,
              monthNum
            )
          )
        : workedHours

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Error fetching worked hours:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/hours — legacy disabilitato: solo gli admin registrano le ore
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(
    {
      error:
        'Le ore possono essere inserite solo dall’amministrazione. Contatta un amministratore.',
    },
    { status: 403 }
  )
}
