import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addDays } from 'date-fns'

// GET /api/substitutions - Get substitutions for user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'available' or 'my-requests'

    if (type === 'available') {
      // Get available shifts for substitution (not expired, not the user's own shifts)
      const availableShifts = await prisma.shifts.findMany({
        where: {
          userId: { not: session.user.id },
          substitutions: {
            some: {
              status: 'PENDING',
              deadline: { gt: new Date() }
            }
          }
        },
        include: {
          user: {
            select: {
              id: true,
              username: true
            }
          },
          schedule: true,
          substitutions: {
            where: {
              status: 'PENDING'
            },
            include: {
              requester: {
                select: {
                  id: true,
                  username: true
                }
              }
            }
          }
        },
        orderBy: [
          { schedule: { weekStart: 'asc' } },
          { dayOfWeek: 'asc' },
          { shiftType: 'asc' }
        ]
      })

      return NextResponse.json(availableShifts)
    } else {
      // Get user's substitution requests
      const substitutions = await prisma.substitutions.findMany({
        where: {
          requesterId: session.user.id
        },
        include: {
          shift: {
            include: {
              schedule: true,
              user: {
                select: {
                  id: true,
                  username: true
                }
              }
            }
          },
          approver: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return NextResponse.json(substitutions)
    }
  } catch (error) {
    console.error('Error fetching substitutions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/substitutions - Request substitution
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { shiftId, requestNote } = await request.json()

    if (!shiftId) {
      return NextResponse.json(
        { error: 'Shift ID required' },
        { status: 400 }
      )
    }

    // Check if shift exists and user can substitute
    const shift = await prisma.shifts.findFirst({
      where: {
        id: shiftId,
        userId: { not: session.user.id }, // Cannot substitute own shift
        substitutions: {
          none: {
            requesterId: session.user.id,
            status: { in: ['PENDING', 'APPROVED'] }
          }
        }
      },
      include: {
        schedule: true
      }
    })

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not available for substitution' },
        { status: 400 }
      )
    }

    // Check if user has the required role
    const user_roles = await prisma.userRole.findMany({
      where: { userId: session.user.id }
    })
    
    const hasRequiredRole = user_roles.some(ur => ur.role === shift.role)
    if (!hasRequiredRole) {
      return NextResponse.json(
        { error: 'You do not have the required role for this shift' },
        { status: 400 }
      )
    }

    // Set deadline (e.g., 24 hours before shift start)
    const shiftDate = new Date(shift.schedule.weekStart)
    shiftDate.setDate(shiftDate.getDate() + shift.dayOfWeek)
    const deadline = addDays(shiftDate, -1) // 1 day before

    if (new Date() > deadline) {
      return NextResponse.json(
        { error: 'Substitution deadline has passed' },
        { status: 400 }
      )
    }

    const substitution = await prisma.substitutions.create({
      data: {
        shiftId,
        requesterId: session.user.id,
        requestNote: requestNote || null,
        deadline
      }
    })

    return NextResponse.json(substitution)
  } catch (error) {
    console.error('Error creating substitution:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
