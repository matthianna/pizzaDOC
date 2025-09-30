import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek, endOfWeek } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'Week start parameter required' }, { status: 400 })
    }

    const weekStart = startOfWeek(new Date(weekStartParam), { weekStartsOn: 1 })
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

    // Get all availability for this week
    const availabilities = await prisma.availability.findMany({
      where: {
        weekStart: {
          gte: weekStart,
          lte: weekEnd
        },
        isAvailable: true
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        }
      }
    })

    // Group by day and shift type
    const availabilityData: { [key: number]: { [key: string]: any[] } } = {}

    // Initialize structure for 7 days
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      availabilityData[dayIndex] = {
        PRANZO: [],
        CENA: []
      }
    }

    console.log(`[DEBUG] Found ${availabilities.length} availabilities for weekly overview`)
    
    // Fill with available users
    availabilities.forEach(availability => {
      const dayIndex = availability.dayOfWeek
      const shiftType = availability.shiftType
      
      if (availabilityData[dayIndex] && availabilityData[dayIndex][shiftType]) {
        availabilityData[dayIndex][shiftType].push({
          id: availability.user.id,
          username: availability.user.username,
          primaryRole: availability.user.primaryRole
        })
      }
    })

    console.log(`[DEBUG] Weekly availability data generated`)
    return NextResponse.json(availabilityData)
  } catch (error) {
    console.error('Error fetching weekly availability:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
