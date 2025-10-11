import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addDays } from 'date-fns'
import { normalizeDate } from '@/lib/normalize-date'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Get user's future shifts (not past and not already requested for substitution)
    const shifts = await prisma.shifts.findMany({
      where: {
        userId: session.user.id,
        schedule: {
          weekStart: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7) // Include current week
          }
        },
        NOT: {
          substitutions: {
            some: {
              status: {
                in: ['PENDING', 'APPLIED', 'APPROVED']
              }
            }
          }
        }
      },
      include: {
        schedule: {
          select: {
            weekStart: true
          }
        }
      },
      orderBy: [
        { schedule: { weekStart: 'asc' } },
        { dayOfWeek: 'asc' },
        { shiftType: 'asc' }
      ]
    })

    // Filter out past shifts
    const futureShifts = shifts.filter(shift => {
      const weekStart = normalizeDate(shift.schedules.weekStart)
      // dayOfWeek è già nel formato corretto: 0=Lunedì, 1=Martedì, ..., 6=Domenica
      const shiftDate = addDays(weekStart, shift.dayOfWeek)
      return shiftDate > now
    })

    return NextResponse.json(futureShifts)
  } catch (error) {
    console.error('Error fetching future shifts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
