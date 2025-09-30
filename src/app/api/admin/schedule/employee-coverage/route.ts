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

    // Get all users with their availability and assigned shifts for this week
    const users = await prisma.user.findMany({
      where: {
        roles: {
          hasSome: ['FATTORINO', 'CUCINA', 'SALA', 'PIZZAIOLO']
        }
      },
      include: {
        availability: {
          where: {
            weekStart: {
              gte: weekStart,
              lte: weekEnd
            }
          }
        },
        shifts: {
          where: {
            weekStart: {
              gte: weekStart,
              lte: weekEnd
            }
          }
        }
      }
    })

    const employeeStats = users.map(user => {
      const availableShifts = user.availability.filter(a => a.isAvailable)
      const assignedShifts = user.shifts

      return {
        id: user.id,
        username: user.username,
        primaryRole: user.primaryRole,
        available: availableShifts.length,
        assigned: assignedShifts.length,
        availableShifts: availableShifts.map(a => ({
          dayOfWeek: a.dayOfWeek,
          shiftType: a.shiftType
        })),
        assignedShifts: assignedShifts.map(s => ({
          dayOfWeek: s.dayOfWeek,
          shiftType: s.shiftType,
          startTime: s.startTime
        }))
      }
    })

    // Sort by utilization rate (highest first)
    employeeStats.sort((a, b) => {
      const aUtilization = a.available > 0 ? (a.assigned / a.available) : 0
      const bUtilization = b.available > 0 ? (b.assigned / b.available) : 0
      return bUtilization - aUtilization
    })

    return NextResponse.json(employeeStats)
  } catch (error) {
    console.error('Error fetching employee coverage:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
