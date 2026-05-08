import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { HoursStatus, Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  isUtcCalendarMonth,
  shiftCalendarDateUtc,
  utcWeekStartBoundsForCalendarMonth,
} from '@/lib/date-utils'
import { logAuditAction } from '@/lib/audit-logger'

function parseAdminTimeRange(startTime: string, endTime: string): {
  ok: true
  totalHours: number
} | { ok: false; error: string } {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return { ok: false, error: 'Formato orario non valido' }
  }

  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)

  let totalMinutes = endHour * 60 + endMin - (startHour * 60 + startMin)
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60
  }

  const totalHours = totalMinutes / 60
  if (totalHours <= 0 || totalHours > 24) {
    return { ok: false, error: 'Intervallo orario non valido' }
  }

  return { ok: true, totalHours }
}

// POST /api/admin/hours — inserimento ore da admin (turno senza worked_hours)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const roles = session?.user?.roles
    if (!session?.user?.id || !Array.isArray(roles) || !roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { shiftId, startTime, endTime } = await request.json()
    if (!shiftId || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'shiftId, startTime e endTime sono obbligatori' },
        { status: 400 }
      )
    }

    const parsed = parseAdminTimeRange(startTime, endTime)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const shift = await prisma.shifts.findFirst({
      where: { id: shiftId },
      include: {
        worked_hours: { select: { id: true } },
        user: { select: { id: true, username: true, trackHours: true, isActive: true } },
      },
    })

    if (!shift) {
      return NextResponse.json({ error: 'Turno non trovato' }, { status: 404 })
    }

    if (!shift.user?.isActive || !shift.user.trackHours) {
      return NextResponse.json(
        { error: 'Utente non attivo o senza tracciamento ore' },
        { status: 400 }
      )
    }

    if (shift.worked_hours) {
      return NextResponse.json(
        { error: 'Esiste già una registrazione ore per questo turno' },
        { status: 400 }
      )
    }

    const now = new Date()
    const workedHours = await prisma.worked_hours.create({
      data: {
        id: crypto.randomUUID(),
        shiftId,
        userId: shift.userId,
        startTime,
        endTime,
        totalHours: parsed.totalHours,
        status: 'APPROVED',
        submittedAt: now,
        reviewedAt: now,
        updatedAt: now,
      },
      include: {
        user: {
          select: { id: true, username: true, primaryRole: true },
        },
        shifts: { include: { schedules: true } },
      },
    })

    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'HOURS_EDIT',
      description: `Inserite ore (admin) per ${shift.user.username}: ${startTime}-${endTime} (${parsed.totalHours}h)`,
      metadata: {
        workedHoursId: workedHours.id,
        userId: workedHours.userId,
        shiftId,
        startTime,
        endTime,
        totalHours: parsed.totalHours,
        source: 'admin_create',
      },
    })

    const wh: any = workedHours
    return NextResponse.json({
      ...wh,
      shift: {
        ...wh.shifts,
        schedule: { weekStart: wh.shifts.schedules.weekStart },
      },
    })
  } catch (error) {
    console.error('Error creating worked hours (admin):', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/admin/hours - Get all hours for review
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    const roles = session?.user?.roles
    if (!session?.user?.id || !Array.isArray(roles) || !roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const allMonths =
      searchParams.get('allMonths') === '1' ||
      searchParams.get('allMonths') === 'true'

    const whereClause: Prisma.worked_hoursWhereInput = {}

    if (status) {
      whereClause.status = status as HoursStatus
    }

    if (!allMonths && month && year) {
      const yearNum = parseInt(year, 10)
      const monthNum = parseInt(month, 10)
      if (Number.isFinite(yearNum) && Number.isFinite(monthNum)) {
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
      !allMonths &&
      Number.isFinite(yearNum) &&
      Number.isFinite(monthNum) &&
      Boolean(month && year)

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
