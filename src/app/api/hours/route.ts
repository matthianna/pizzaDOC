import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateHours } from '@/lib/utils'

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

    let dateFilter = {}
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
      const endDate = new Date(parseInt(year), parseInt(month), 0)
      dateFilter = {
        shift: {
          schedule: {
            weekStart: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      }
    }

    const workedHours = await prisma.worked_hours.findMany({
      where: {
        userId: session.user.id,
        ...dateFilter
      },
      include: {
        shift: {
          include: {
            schedule: true
          }
        }
      },
      orderBy: {
        submittedAt: 'desc'
      }
    })

    return NextResponse.json(workedHours)
  } catch (error) {
    console.error('Error fetching worked hours:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/hours - Submit worked hours
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { shiftId, startTime, endTime } = await request.json()

    if (!shiftId || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Dati mancanti' },
        { status: 400 }
      )
    }

    // Check if user has trackHours enabled
    const user = await prisma.User.findUnique({
      where: { id: session.user.id },
      select: { trackHours: true }
    })

    if (!user || !user.trackHours) {
      return NextResponse.json(
        { error: 'Il conteggio ore non è abilitato per questo utente' },
        { status: 403 }
      )
    }

    // Validate time format and logic
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { error: 'Formato orario non valido' },
        { status: 400 }
      )
    }

    const totalHours = calculateHours(startTime, endTime)
    if (totalHours <= 0) {
      return NextResponse.json(
        { error: 'L\'orario di fine deve essere successivo a quello di inizio' },
        { status: 400 }
      )
    }

    // Check if shift belongs to user
    const shift = await prisma.shifts.findFirst({
      where: {
        id: shiftId,
        userId: session.user.id
      }
    })

    if (!shift) {
      return NextResponse.json(
        { error: 'Turno non trovato' },
        { status: 404 }
      )
    }

    // Check if hours already submitted
    const existingHours = await prisma.worked_hours.findUnique({
      where: { shiftId }
    })

    if (existingHours) {
      return NextResponse.json(
        { error: 'Ore già inserite per questo turno' },
        { status: 400 }
      )
    }

    const workedHours = await prisma.worked_hours.create({
      data: {
        id: crypto.randomUUID(),
        shiftId,
        userId: session.user.id,
        startTime,
        endTime,
        totalHours,
        updatedAt: new Date()
      }
    })

    return NextResponse.json(workedHours)
  } catch (error) {
    console.error('Error submitting worked hours:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
