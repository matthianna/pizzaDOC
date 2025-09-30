import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getWeekStart } from '@/lib/date-utils'

// GET /api/availability - Get user's availability for a specific week
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'Week start required' }, { status: 400 })
    }

    const weekStart = new Date(weekStartParam)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    // Controlla se l'utente ha assenze in questa settimana
    const absences = await prisma.absence.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            AND: [
              { startDate: { lte: weekEnd } },
              { endDate: { gte: weekStart } }
            ]
          }
        ]
      }
    })

    const hasAbsences = absences.length > 0

    if (hasAbsences) {
      // Se ha assenze, restituisci informazioni sull'assenza
      return NextResponse.json({
        isAbsentWeek: true,
        absences: absences.map(absence => ({
          id: absence.id,
          type: absence.type,
          startDate: absence.startDate,
          endDate: absence.endDate,
          reason: absence.reason,
          status: absence.status
        })),
        availabilities: []
      })
    }

    const availabilities = await prisma.availability.findMany({
      where: {
        userId: session.user.id,
        weekStart
      }
    })

    return NextResponse.json({
      isAbsentWeek: false,
      absences: [],
      availabilities
    })
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { weekStart, availabilities, isAbsentWeek } = await request.json()

    if (!weekStart) {
      return NextResponse.json({ error: 'Week start required' }, { status: 400 })
    }

    const weekStartDate = new Date(weekStart)
    const weekEnd = new Date(weekStartDate)
    weekEnd.setDate(weekEnd.getDate() + 6)

    // Controlla se l'utente ha assenze in questa settimana
    const absences = await prisma.absence.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            AND: [
              { startDate: { lte: weekEnd } },
              { endDate: { gte: weekStartDate } }
            ]
          }
        ]
      }
    })

    if (absences.length > 0 && !isAbsentWeek) {
      return NextResponse.json({ 
        error: 'Cannot set availability for a week with absences',
        absences: absences.map(absence => ({
          id: absence.id,
          type: absence.type,
          startDate: absence.startDate,
          endDate: absence.endDate,
          reason: absence.reason
        }))
      }, { status: 400 })
    }

    // Delete existing availabilities for this week
    await prisma.availability.deleteMany({
      where: {
        userId: session.user.id,
        weekStart: weekStartDate
      }
    })

    if (isAbsentWeek) {
      // Create availability records marking user as absent for the whole week
      const availabilityRecords = []
      for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
        for (const shiftType of ['PRANZO', 'CENA']) {
          availabilityRecords.push({
            userId: session.user.id,
            weekStart: weekStartDate,
            dayOfWeek,
            shiftType: shiftType as 'PRANZO' | 'CENA',
            isAvailable: false,
            isAbsentWeek: true
          })
        }
      }

      await prisma.availability.createMany({
        data: availabilityRecords
      })
    } else {
      // Create availability records based on user selections
      const availabilityRecords = availabilities.map((avail: any) => ({
        userId: session.user.id,
        weekStart: weekStartDate,
        dayOfWeek: avail.dayOfWeek,
        shiftType: avail.shiftType,
        isAvailable: avail.isAvailable,
        isAbsentWeek: false
      }))

      if (availabilityRecords.length > 0) {
        await prisma.availability.createMany({
          data: availabilityRecords
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving availability:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
