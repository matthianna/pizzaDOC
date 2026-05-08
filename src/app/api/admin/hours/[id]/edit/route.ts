import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-logger'
import { validateAdminWorkedTimes } from '@/lib/admin-worked-time-rules'

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
        { error: 'Orario di inizio e fine obbligatori' },
        { status: 400 }
      )
    }

    const existing = await prisma.worked_hours.findUnique({
      where: { id },
      select: {
        status: true,
        shifts: { select: { shiftType: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Ore non trovate' }, { status: 404 })
    }

    const validated = validateAdminWorkedTimes(
      existing.shifts.shiftType,
      startTime,
      endTime
    )
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const totalHours = validated.totalHours

    const reactivatedFromReject = existing.status === 'REJECTED'

    // Aggiorna le ore lavorate
    const updatedHours = await prisma.worked_hours.update({
      where: { id },
      data: {
        startTime,
        endTime,
        totalHours,
        updatedAt: new Date(),
        ...(reactivatedFromReject
          ? {
              status: 'APPROVED',
              rejectionReason: null,
              reviewedAt: new Date(),
            }
          : {}),
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
      description: reactivatedFromReject
        ? `Corrette e riapprovate ore di ${updatedHours.user.username}: ${startTime}-${endTime} (${totalHours}h)`
        : `Modificate ore di ${updatedHours.user.username}: ${startTime}-${endTime} (${totalHours}h)`,
      metadata: {
        workedHoursId: updatedHours.id,
        userId: updatedHours.userId,
        startTime,
        endTime,
        totalHours,
        ...(reactivatedFromReject ? { fromRejected: true } : {}),
      },
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

