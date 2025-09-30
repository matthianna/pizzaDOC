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

    const availabilities = await prisma.availability.findMany({
      where: {
        userId: session.user.id,
        weekStart
      }
    })

    return NextResponse.json(availabilities)
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
      const availabilityRecords = availabilities.map((avail: { dayOfWeek: number; shiftType: string; isAvailable: boolean }) => ({
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
