import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'Week start parameter is required' }, { status: 400 })
    }

    const weekStart = new Date(weekStartParam)

    // Get availability for this week
    const availabilities = await prisma.availability.findMany({
      where: {
        weekStart: weekStart,
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

    // Check for absences that might affect availability
    const absences = await prisma.absence.findMany({
      where: {
        status: { in: ['APPROVED', 'PENDING'] },
        OR: [
          {
            startDate: { lte: weekStart },
            endDate: { gte: weekStart }
          }
        ]
      },
      select: {
        userId: true,
        startDate: true,
        endDate: true
      }
    })

    // Build weekly availability data
    const weeklyData: any = {}

    // Initialize structure for 7 days
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      weeklyData[dayIndex] = {
        PRANZO: [],
        CENA: []
      }
    }

    // Process each availability record
    availabilities.forEach(availability => {
      // Check if user is absent during this week
      const userAbsent = absences.some(absence => absence.userId === availability.userId)
      
      if (!userAbsent) {
        const user = {
          id: availability.user.id,
          username: availability.user.username,
          primaryRole: availability.user.primaryRole
        }

        // Map availability fields to days and shifts
        const availabilityMap = [
          { pranzo: availability.mondayPranzo, cena: availability.mondayCena },      // Monday (0)
          { pranzo: availability.tuesdayPranzo, cena: availability.tuesdayCena },    // Tuesday (1)
          { pranzo: availability.wednesdayPranzo, cena: availability.wednesdayCena }, // Wednesday (2)
          { pranzo: availability.thursdayPranzo, cena: availability.thursdayCena },  // Thursday (3)
          { pranzo: availability.fridayPranzo, cena: availability.fridayCena },      // Friday (4)
          { pranzo: availability.saturdayPranzo, cena: availability.saturdayCena },  // Saturday (5)
          { pranzo: availability.sundayPranzo, cena: availability.sundayCena }       // Sunday (6)
        ]

        availabilityMap.forEach((dayAvailability, dayIndex) => {
          if (dayAvailability.pranzo) {
            weeklyData[dayIndex].PRANZO.push(user)
          }
          if (dayAvailability.cena) {
            weeklyData[dayIndex].CENA.push(user)
          }
        })
      }
    })

    // Sort users by role for better readability
    const roleOrder = ['PIZZAIOLO', 'CUCINA', 'SALA', 'FATTORINO']
    
    Object.keys(weeklyData).forEach(dayIndex => {
      ['PRANZO', 'CENA'].forEach(shift => {
        weeklyData[dayIndex][shift].sort((a: any, b: any) => {
          const roleIndexA = roleOrder.indexOf(a.primaryRole) 
          const roleIndexB = roleOrder.indexOf(b.primaryRole)
          
          if (roleIndexA !== roleIndexB) {
            return roleIndexA - roleIndexB
          }
          
          return a.username.localeCompare(b.username)
        })
      })
    })

    return NextResponse.json(weeklyData)
  } catch (error) {
    console.error('Error fetching weekly availability:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
