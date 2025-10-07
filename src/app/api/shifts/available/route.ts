import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAfter, endOfDay } from 'date-fns'

// GET /api/shifts/available - Get available shifts for user to submit hours
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Get user's shifts where they can submit hours
    const shifts = await prisma.shifts.findMany({
      where: {
        userId: session.user.id,
        // Only shifts that have ended (schedule date + shift end time is past)
        schedule: {
          weekStart: {
            lt: now // Only past weeks for now (simplified)
          }
        },
        // Don't show shifts that already have hours submitted
        worked_hours: null
      },
      include: {
        schedule: true,
        worked_hours: true
      },
      orderBy: [
        { schedule: { weekStart: 'desc' } },
        { dayOfWeek: 'asc' },
        { shiftType: 'asc' }
      ]
    })

    // Filter shifts that have actually ended
    const availableShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.schedule.weekStart)
      shiftDate.setDate(shiftDate.getDate() + shift.dayOfWeek)
      
      const [endHour, endMin] = shift.endTime.split(':').map(Number)
      const shiftEndTime = new Date(shiftDate)
      shiftEndTime.setHours(endHour, endMin, 0, 0)
      
      return isAfter(now, shiftEndTime)
    })

    return NextResponse.json(availableShifts)
  } catch (error) {
    console.error('Error fetching available shifts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
