import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek, endOfWeek, addDays, startOfDay, isWithinInterval } from 'date-fns'

// GET /api/user/absences/check?weekStart=YYYY-MM-DD - Check if user has absences in a specific week
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'weekStart parameter required' }, { status: 400 })
    }

    const weekStart = new Date(weekStartParam)
    const weekEnd = endOfWeek(startOfWeek(weekStart, { weekStartsOn: 1 }), { weekStartsOn: 1 })

    // Check for any approved absences that overlap with this week
    const absences = await prisma.absence.findMany({
      where: {
        userId: session.user.id,
        status: 'APPROVED',
        OR: [
          {
            // Absence starts within the week
            startDate: {
              gte: weekStart,
              lte: weekEnd
            }
          },
          {
            // Absence ends within the week
            endDate: {
              gte: weekStart,
              lte: weekEnd
            }
          },
          {
            // Absence spans the entire week
            startDate: { lte: weekStart },
            endDate: { gte: weekEnd }
          }
        ]
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        type: true,
        reason: true
      }
    })

    // Check day by day which days are blocked
    const blockedDays: number[] = []
    
    for (let i = 0; i < 7; i++) {
      const currentDay = addDays(weekStart, i)
      const dayStart = startOfDay(currentDay)
      
      // Check if this day is within any absence period
      const isDayBlocked = absences.some(absence => {
        const absenceStart = startOfDay(new Date(absence.startDate))
        const absenceEnd = startOfDay(new Date(absence.endDate))
        
        return isWithinInterval(dayStart, {
          start: absenceStart,
          end: absenceEnd
        })
      })
      
      if (isDayBlocked) {
        blockedDays.push(i) // i = dayOfWeek (0=Monday, 6=Sunday)
      }
    }

    // User is considered absent for the week only if ALL 7 days are blocked
    const hasFullWeekAbsence = blockedDays.length === 7

    return NextResponse.json({
      hasAbsence: hasFullWeekAbsence,
      absences: absences,
      blockedDays: blockedDays, // Array of blocked day indices
      hasPartialAbsence: blockedDays.length > 0 && blockedDays.length < 7
    })
  } catch (error) {
    console.error('Error checking absences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
