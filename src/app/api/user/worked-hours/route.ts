import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { TZDate } from '@date-fns/tz'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import { addWeekCalendarDays, ensureUtcMondayWeekStart } from '@/lib/date-utils'

const APP_TIMEZONE = 'Europe/Rome'
const DAY_MS = 86400000

// GET - Fetch worked hours for a user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'Week start parameter is required' }, { status: 400 })
    }

    const weekStart = normalizeDate(weekStartParam)
    const candidateTimes = [
      weekStart.getTime() - DAY_MS,
      weekStart.getTime(),
      weekStart.getTime() + DAY_MS,
    ]
    const weekStartCandidates = [
      ...new Set(candidateTimes.map((t) => normalizeDate(new Date(t)).getTime())),
    ].map((t) => new Date(t))

    const workedHours = await prisma.worked_hours.findMany({
      where: {
        userId: session.user.id,
        shifts: {
          schedules: {
            weekStart: { in: weekStartCandidates },
          },
        },
      },
      include: {
        shifts: {
          include: {
            schedules: true
          }
        }
      }
      // Note: Cannot use nested orderBy with Prisma, will sort in JavaScript below
    })

    // Sort in JavaScript since Prisma doesn't support nested orderBy
    const sortedHours = workedHours.sort((a: any, b: any) => {
      if (a.shifts.dayOfWeek !== b.shifts.dayOfWeek) {
        return a.shifts.dayOfWeek - b.shifts.dayOfWeek
      }
      // If same day, sort by shift type (PRANZO before CENA)
      return a.shifts.shiftType === 'PRANZO' ? -1 : 1
    })

    return NextResponse.json(sortedHours)
  } catch (error) {
    console.error('Error fetching worked hours:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Submit worked hours for approval
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { shiftId, startTime, endTime, totalHours } = await request.json()

    if (!shiftId || !startTime || !endTime || typeof totalHours !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify the shift belongs to this user
    const shift = await prisma.shifts.findFirst({
      where: {
        id: shiftId,
        userId: session.user.id
      },
      include: {
        schedules: true
      }
    })

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found or not assigned to you' },
        { status: 404 }
      )
    }

    const ws = ensureUtcMondayWeekStart(shift.schedules.weekStart)
    const shiftDate = addWeekCalendarDays(ws, shift.dayOfWeek)

    const [shiftStartHour, shiftStartMinute] = shift.startTime.split(':').map(Number)
    const shiftStartInstant = new TZDate(
      shiftDate.getUTCFullYear(),
      shiftDate.getUTCMonth(),
      shiftDate.getUTCDate(),
      shiftStartHour,
      shiftStartMinute,
      0,
      APP_TIMEZONE
    )

    const now = new Date()
    if (shiftStartInstant.getTime() > now.getTime()) {
      return NextResponse.json(
        { error: `Non puoi inserire le ore prima che il turno inizi (alle ${shift.startTime})` },
        { status: 400 }
      )
    }

    // Check if hours already submitted for this shift
    const existingHours = await prisma.worked_hours.findUnique({
      where: { shiftId }
    })

    if (existingHours) {
      return NextResponse.json(
        { error: 'Hours already submitted for this shift' },
        { status: 400 }
      )
    }

    // Validate time format and logic
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { error: 'Invalid time format' },
        { status: 400 }
      )
    }

    if (startTime >= endTime) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      )
    }

    // Calculate hours to verify
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    const calculatedMinutes = endMinutes - startMinutes
    const calculatedHours = Math.round((calculatedMinutes / 60) * 2) / 2 // Round to nearest 0.5

    if (Math.abs(calculatedHours - totalHours) > 0.01) {
      return NextResponse.json(
        { error: 'Total hours calculation mismatch' },
        { status: 400 }
      )
    }

    // Create worked hours record
    const workedHours = await prisma.worked_hours.create({
      data: {
        id: crypto.randomUUID(),
        shiftId,
        userId: session.user.id,
        startTime,
        endTime,
        totalHours: calculatedHours,
        status: 'PENDING',
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      workedHours
    })
  } catch (error) {
    console.error('Error submitting worked hours:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
