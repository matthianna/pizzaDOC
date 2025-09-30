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

    // Get the schedule for this week
    const schedule = await prisma.schedule.findFirst({
      where: {
        weekStart: {
          gte: weekStart,
          lte: weekEnd
        }
      },
      include: {
        shifts: {
          include: {
            user: true
          }
        }
      }
    })

    // Get all users with their availability for this week
    const users = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: {
              in: ['FATTORINO', 'CUCINA', 'SALA', 'PIZZAIOLO']
            }
          }
        }
      },
      include: {
        userRoles: true,
        availability: {
          where: {
            weekStart: {
              gte: weekStart,
              lte: weekEnd
            }
          }
        }
      }
    })

    console.log(`[DEBUG] Found ${users.length} users for employee coverage`)
    console.log(`[DEBUG] Schedule exists: ${!!schedule}, shifts: ${schedule?.shifts.length || 0}`)
    
    const employeeStats = users.map(user => {
      const availableShifts = user.availability.filter(a => a.isAvailable)
      const assignedShifts = schedule?.shifts.filter(s => s.userId === user.id) || []

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
    
    console.log(`[DEBUG] Employee stats generated: ${employeeStats.length} employees`)

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
