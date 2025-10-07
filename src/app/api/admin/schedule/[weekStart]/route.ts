import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'

// GET /api/admin/schedule/[weekStart] - Get schedule for a specific week
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const weekStart = normalizeDate(resolvedParams.weekStart)
    
    const schedule = await prisma.schedules.findUnique({
      where: { weekStart },
      include: {
        shifts: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                primaryRole: true,
                primaryTransport: true,
                user_transports: {
                  select: {
                    transport: true
                  }
                }
              }
            }
          },
          orderBy: [
            { dayOfWeek: 'asc' },
            { shiftType: 'asc' },
            { role: 'asc' }
          ]
        }
      }
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/schedule/[weekStart] - Delete schedule for a specific week
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const weekStart = normalizeDate(resolvedParams.weekStart)

    const schedule = await prisma.schedules.findUnique({
      where: { weekStart }
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    await prisma.shifts.deleteMany({
      where: { scheduleId: schedule.id }
    })

    await prisma.schedules.delete({
      where: { id: schedule.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
