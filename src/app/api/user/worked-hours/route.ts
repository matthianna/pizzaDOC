import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'

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

    // Find all worked hours for user's shifts in this week
    const workedHours = await prisma.worked_hours.findMany({
      where: {
        userId: session.user.id,
        shift: {
          schedule: {
            weekStart: weekStart
          }
        }
      },
      include: {
        shift: {
          include: {
            schedule: true
          }
        }
      },
      orderBy: [
        { shift: { dayOfWeek: 'asc' } },
        { shift: { shiftType: 'asc' } }
      ]
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
    const shift = await prisma.shift.findFirst({
      where: {
        id: shiftId,
        userId: session.user.id
      }
    })

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found or not assigned to you' },
        { status: 404 }
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
        shiftId,
        userId: session.user.id,
        startTime,
        endTime,
        totalHours: calculatedHours,
        status: 'PENDING'
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
