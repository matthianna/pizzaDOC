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
      return NextResponse.json({ error: 'Week start parameter is required' }, { status: 400 })
    }

    const weekStart = new Date(weekStartParam)
    const weekEnd = endOfWeek(startOfWeek(weekStart, { weekStartsOn: 1 }), { weekStartsOn: 1 })

    // Get all active users
    const users = await prisma.user.findMany({
      where: {
        active: true
      },
      select: {
        id: true,
        username: true,
        roles: true,
        primaryRole: true
      }
    })

    // Get availability for this week
    const availabilities = await prisma.availability.findMany({
      where: {
        weekStart: weekStart,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    })

    // Get assigned shifts for this week
    const shifts = await prisma.shift.findMany({
      where: {
        weekStart: weekStart,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    })

    // Build employee stats
    const employeeStats = users.map(user => {
      // Get user's availability
      const userAvailability = availabilities.filter(a => a.userId === user.id)
      const availableShifts = userAvailability.flatMap(a => [
        ...(a.mondayPranzo ? [{ dayOfWeek: 0, shiftType: 'PRANZO' }] : []),
        ...(a.mondayCena ? [{ dayOfWeek: 0, shiftType: 'CENA' }] : []),
        ...(a.tuesdayPranzo ? [{ dayOfWeek: 1, shiftType: 'PRANZO' }] : []),
        ...(a.tuesdayCena ? [{ dayOfWeek: 1, shiftType: 'CENA' }] : []),
        ...(a.wednesdayPranzo ? [{ dayOfWeek: 2, shiftType: 'PRANZO' }] : []),
        ...(a.wednesdayCena ? [{ dayOfWeek: 2, shiftType: 'CENA' }] : []),
        ...(a.thursdayPranzo ? [{ dayOfWeek: 3, shiftType: 'PRANZO' }] : []),
        ...(a.thursdayCena ? [{ dayOfWeek: 3, shiftType: 'CENA' }] : []),
        ...(a.fridayPranzo ? [{ dayOfWeek: 4, shiftType: 'PRANZO' }] : []),
        ...(a.fridayCena ? [{ dayOfWeek: 4, shiftType: 'CENA' }] : []),
        ...(a.saturdayPranzo ? [{ dayOfWeek: 5, shiftType: 'PRANZO' }] : []),
        ...(a.saturdayCena ? [{ dayOfWeek: 5, shiftType: 'CENA' }] : []),
        ...(a.sundayPranzo ? [{ dayOfWeek: 6, shiftType: 'PRANZO' }] : []),
        ...(a.sundayCena ? [{ dayOfWeek: 6, shiftType: 'CENA' }] : []),
      ])

      // Get user's assigned shifts
      const userShifts = shifts.filter(s => s.userId === user.id)
      const assignedShifts = userShifts.map(s => ({
        dayOfWeek: s.dayOfWeek,
        shiftType: s.shiftType
      }))

      return {
        id: user.id,
        username: user.username,
        primaryRole: user.primaryRole,
        available: availableShifts.length,
        assigned: assignedShifts.length,
        availableShifts: availableShifts,
        assignedShifts: assignedShifts
      }
    })

    // Sort by utilization percentage (descending)
    employeeStats.sort((a, b) => {
      const utilizationA = a.available > 0 ? (a.assigned / a.available) : 0
      const utilizationB = b.available > 0 ? (b.assigned / b.available) : 0
      return utilizationB - utilizationA
    })

    return NextResponse.json(employeeStats)
  } catch (error) {
    console.error('Error fetching employee coverage stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
