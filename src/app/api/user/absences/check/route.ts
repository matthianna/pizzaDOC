import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek, endOfWeek } from 'date-fns'

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

    return NextResponse.json({
      hasAbsence: absences.length > 0,
      absences: absences
    })
  } catch (error) {
    console.error('Error checking absences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
