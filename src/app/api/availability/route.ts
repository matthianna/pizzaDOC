import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import {
  dateForAvailabilityDay,
  holidayBlocksSlot,
  utcCalendarKey,
} from '@/lib/availability-holidays'
import { canEditAvailability, ensureUtcMondayWeekStart, formatDate } from '@/lib/date-utils'
import { logAuditAction } from '@/lib/audit-logger'

// GET /api/availability - Get user's availability for a specific week
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'Week start required' }, { status: 400 })
    }

    const weekStart = normalizeDate(weekStartParam)
    const weekSunday = dateForAvailabilityDay(weekStart, 6)

    const [availabilities, holidays] = await Promise.all([
      prisma.availabilities.findMany({
        where: {
          userId: session.user.id,
          weekStart,
        },
      }),
      prisma.holidays.findMany({
        where: {
          date: { gte: weekStart, lte: weekSunday },
        },
        select: { date: true, closureType: true },
      }),
    ])

    const merged = availabilities.map((a) => {
      const slotKey = utcCalendarKey(dateForAvailabilityDay(weekStart, a.dayOfWeek))
      const blocked = holidayBlocksSlot(holidays, slotKey, a.shiftType)
      if (blocked && a.isAvailable) {
        return { ...a, isAvailable: false }
      }
      return a
    })

    return NextResponse.json(merged)
  } catch (error) {
    console.error('Error fetching availability:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/availability - Save user's availability for a week
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { weekStart, availabilities, isAbsentWeek } = await request.json()

    if (!weekStart) {
      return NextResponse.json({ error: 'Week start required' }, { status: 400 })
    }

    const weekStartDate = ensureUtcMondayWeekStart(normalizeDate(weekStart))

    if (!canEditAvailability(weekStartDate)) {
      return NextResponse.json(
        { error: 'La disponibilità di questa settimana non è più modificabile' },
        { status: 403 }
      )
    }

    const weekSunday = dateForAvailabilityDay(weekStartDate, 6)

    const existingCount = await prisma.availabilities.count({
      where: {
        userId: session.user.id,
        weekStart: weekStartDate,
      },
    })

    const holidays = await prisma.holidays.findMany({
      where: {
        date: { gte: weekStartDate, lte: weekSunday },
      },
      select: { date: true, closureType: true },
    })

    // Delete existing availabilities for this week
    await prisma.availabilities.deleteMany({
      where: {
        userId: session.user.id,
        weekStart: weekStartDate
      }
    })

    if (isAbsentWeek) {
      // Create availability records marking user as absent for the whole week
      const availabilityRecords = []
      const now = new Date()
      for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
        for (const shiftType of ['PRANZO', 'CENA']) {
          availabilityRecords.push({
            id: crypto.randomUUID(),
            userId: session.user.id,
            weekStart: weekStartDate,
            dayOfWeek,
            shiftType: shiftType as 'PRANZO' | 'CENA',
            isAvailable: false,
            isAbsentWeek: true,
            updatedAt: now
          })
        }
      }

      await prisma.availabilities.createMany({
        data: availabilityRecords
      })
    } else {
      // Create availability records based on user selections (cannot be available on closed holidays)
      const now = new Date()
      const availabilityRecords = (availabilities as any[]).map((avail: any) => {
        const slotKey = utcCalendarKey(
          dateForAvailabilityDay(weekStartDate, avail.dayOfWeek)
        )
        const blocked = holidayBlocksSlot(holidays, slotKey, avail.shiftType)
        return {
          id: crypto.randomUUID(),
          userId: session.user.id,
          weekStart: weekStartDate,
          dayOfWeek: avail.dayOfWeek,
          shiftType: avail.shiftType,
          isAvailable: blocked ? false : Boolean(avail.isAvailable),
          isAbsentWeek: false,
          updatedAt: now,
        }
      })

      if (availabilityRecords.length > 0) {
        await prisma.availabilities.createMany({
          data: availabilityRecords
        })
      }
    }

    const slots = isAbsentWeek
      ? []
      : ((availabilities as Array<{ shiftType: string; isAvailable: boolean }>) || [])
    const availablePranzo = slots.filter((s) => s.shiftType === 'PRANZO' && s.isAvailable).length
    const availableCena = slots.filter((s) => s.shiftType === 'CENA' && s.isAvailable).length
    const isCreate = existingCount === 0
    const weekLabel = formatDate(weekStartDate)
    const username = session.user.username

    await logAuditAction({
      userId: session.user.id,
      userUsername: username,
      action: isCreate ? 'AVAILABILITY_CREATE' : 'AVAILABILITY_EDIT',
      description: isCreate
        ? `${username} ha inserito la disponibilità per la settimana del ${weekLabel}`
        : `${username} ha modificato la disponibilità per la settimana del ${weekLabel}`,
      metadata: {
        weekStart: weekStartDate.toISOString(),
        availablePranzo,
        availableCena,
        isAbsentWeek: Boolean(isAbsentWeek),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving availability:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
