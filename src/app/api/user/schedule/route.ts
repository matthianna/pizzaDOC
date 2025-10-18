import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'

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

    // Trova il piano per questa settimana
    const schedule = await prisma.schedules.findUnique({
      where: { weekStart },
      include: {
        shifts: {
          where: {
            userId: session.user.id
          },
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            },
            worked_hours: {
              select: {
                id: true,
                status: true,
                totalHours: true
              }
            },
            requestedSubstitutions: {
              where: {
                requesterId: session.user.id,
                status: {
                  in: ['PENDING', 'APPROVED']
                }
              },
              select: {
                id: true,
                status: true,
                createdAt: true,
                substitute: {
                  select: {
                    id: true,
                    username: true
                  }
                }
              },
              orderBy: {
                createdAt: 'desc'
              },
              take: 1
            }
          },
          orderBy: [
            { dayOfWeek: 'asc' },
            { shiftType: 'asc' }
          ]
        }
      }
    })

    if (!schedule) {
      return NextResponse.json([])
    }

    // Map worked_hours to workedHours and include substitution info
    const shiftsWithMappedHours = schedule.shifts.map((shift: any) => ({
      ...shift,
      workedHours: shift.worked_hours,
      activeSubstitution: shift.requestedSubstitutions[0] || null,
      schedule: { weekStart: schedule.weekStart.toISOString() }
    }))

    return NextResponse.json(shiftsWithMappedHours)
  } catch (error) {
    console.error('Error fetching user schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
