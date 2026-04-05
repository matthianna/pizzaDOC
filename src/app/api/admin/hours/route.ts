import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  isUtcCalendarMonth,
  shiftCalendarDateUtc,
  utcWeekStartBoundsForCalendarMonth,
} from '@/lib/date-utils'

// GET /api/admin/hours - Get all hours for review
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    const whereClause: {
      status?: string;
      user?: {
        id: string;
      };
    } = {}

    if (status) {
      whereClause.status = status
    }

    if (month && year) {
      const yearNum = parseInt(year, 10)
      const monthNum = parseInt(month, 10)
      const { gte, lte } = utcWeekStartBoundsForCalendarMonth(yearNum, monthNum)
      whereClause.shifts = {
        schedules: {
          weekStart: {
            gte,
            lte,
          },
        },
      }
    }

    const workedHours = await prisma.worked_hours.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        },
        shifts: {
          include: {
            schedules: true
          }
        }
      }
      // ❌ Non possiamo ordinare qui per data effettiva del turno (weekStart + dayOfWeek)
      // Lo faremo dopo aver recuperato i dati
    })

    // Map shifts -> shift and schedules -> schedule for frontend compatibility
    const mapped = workedHours.map((wh: any) => ({
      ...wh,
      shift: {
        ...wh.shifts,
        schedule: {
          weekStart: wh.shifts.schedules.weekStart
        }
      }
    }))

    const yearNum = year ? parseInt(year, 10) : NaN
    const monthNum = month ? parseInt(month, 10) : NaN
    const filterByShiftMonth =
      Number.isFinite(yearNum) && Number.isFinite(monthNum) && month && year

    const inMonth = filterByShiftMonth
      ? mapped.filter((a: any) =>
          isUtcCalendarMonth(
            shiftCalendarDateUtc(a.shifts.schedules.weekStart, a.shifts.dayOfWeek),
            yearNum,
            monthNum
          )
        )
      : mapped

    // ✅ Ordina per DATA EFFETTIVA DEL TURNO (chronological order)
    const sorted = inMonth.sort((a: any, b: any) => {
      const shiftDateA = shiftCalendarDateUtc(a.shifts.schedules.weekStart, a.shifts.dayOfWeek)
      const shiftDateB = shiftCalendarDateUtc(b.shifts.schedules.weekStart, b.shifts.dayOfWeek)

      if (shiftDateA.getTime() !== shiftDateB.getTime()) {
        return shiftDateA.getTime() - shiftDateB.getTime()
      }

      if (a.shifts.shiftType !== b.shifts.shiftType) {
        return a.shifts.shiftType === 'PRANZO' ? -1 : 1
      }

      return 0
    })

    return NextResponse.json(sorted)
  } catch (error) {
    console.error('Error fetching hours for review:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
