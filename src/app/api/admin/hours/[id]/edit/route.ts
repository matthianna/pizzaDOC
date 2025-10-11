import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-logger'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { startTime, endTime } = body

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'Start time and end time are required' },
        { status: 400 }
      )
    }

    // Calcola le ore totali
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60 // Gestisce i turni che passano la mezzanotte
    }
    
    const totalHours = totalMinutes / 60

    if (totalHours <= 0 || totalHours > 24) {
      return NextResponse.json(
        { error: 'Invalid time range' },
        { status: 400 }
      )
    }

    // Aggiorna le ore lavorate
    const updatedHours = await prisma.worked_hours.update({
      where: { id },
      data: {
        startTime,
        endTime,
        totalHours,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        },
        shifts: {
          include: {
            schedules: true
          }
        }
      }
    })

    // Log audit
    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'HOURS_EDIT',
      description: `Modificate ore di ${updatedHours.user.username}: ${startTime}-${endTime} (${totalHours}h)`,
      metadata: {
        workedHoursId: updatedHours.id,
        userId: updatedHours.userId,
        startTime,
        endTime,
        totalHours
      }
    })

    return NextResponse.json(updatedHours)
  } catch (error) {
    console.error('Error updating worked hours:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

