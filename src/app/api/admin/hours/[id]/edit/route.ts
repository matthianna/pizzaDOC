import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-logger'
import { validateAdminWorkedTimes } from '@/lib/admin-worked-time-rules'
import { formatDecimalHoursIt } from '@/lib/format-hours-display'

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

    const shouldApproveOnSave =
      existing.status === 'REJECTED' || existing.status === 'PENDING'

    // Aggiorna le ore lavorate
    const updatedHours = await prisma.worked_hours.update({
      where: { id },
      data: {
        startTime,
        endTime,
        totalHours,
        updatedAt: new Date(),
        ...(shouldApproveOnSave
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
      description:
        existing.status === 'REJECTED'
          ? `Corrette e riapprovate ore di ${updatedHours.user.username}: ${startTime}-${endTime} (${formatDecimalHoursIt(totalHours)})`
          : existing.status === 'PENDING'
            ? `Salvate e approvate ore di ${updatedHours.user.username}: ${startTime}-${endTime} (${formatDecimalHoursIt(totalHours)})`
            : `Modificate ore di ${updatedHours.user.username}: ${startTime}-${endTime} (${formatDecimalHoursIt(totalHours)})`,
      metadata: {
        workedHoursId: updatedHours.id,
        userId: updatedHours.userId,
        startTime,
        endTime,
        totalHours,
        ...(existing.status === 'REJECTED' ? { fromRejected: true } : {}),
        ...(existing.status === 'PENDING' ? { fromPending: true } : {}),
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

