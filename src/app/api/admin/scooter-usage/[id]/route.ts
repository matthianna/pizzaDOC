import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-logger'
import { getMaxScooterCount, validateScooterNumber, checkScooterConflict } from '@/lib/scooter-usage'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.roles?.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { scooterNumber, userId, usedAuto } = await request.json()

    const existing = await prisma.shift_scooter_usages.findUnique({
      where: { id },
      include: {
        shifts: {
          include: { schedules: { select: { id: true } } },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Record non trovato' }, { status: 404 })
    }

    const updateData: {
      scooterNumber?: number | null
      usedAuto?: boolean
      userId?: string
      updatedAt: Date
      recordedAt?: Date
    } = {
      updatedAt: new Date(),
    }

    if (userId) updateData.userId = userId

    if (usedAuto === true) {
      updateData.usedAuto = true
      updateData.scooterNumber = null
      updateData.recordedAt = new Date()
    } else if (scooterNumber != null) {
      const maxScooters = await getMaxScooterCount()
      const validationError = validateScooterNumber(Number(scooterNumber), maxScooters)
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 })
      }
      updateData.usedAuto = false
      updateData.scooterNumber = Number(scooterNumber)
      updateData.recordedAt = new Date()
    }

    const record = await prisma.shift_scooter_usages.update({
      where: { id },
      data: updateData,
    })

    let warning: string | null = null
    if (updateData.scooterNumber != null && !updateData.usedAuto) {
      warning = await checkScooterConflict(
        existing.shiftId,
        existing.shifts.schedules.id,
        existing.shifts.dayOfWeek,
        existing.shifts.shiftType,
        updateData.scooterNumber
      )
    }

    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'SCOOTER_USAGE_EDIT',
      description: `Admin: modificato record scooter ${id}`,
      metadata: { id, changes: updateData },
    })

    return NextResponse.json({ usage: record, warning })
  } catch (error) {
    console.error('Error updating scooter usage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.roles?.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.shift_scooter_usages.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Record non trovato' }, { status: 404 })
    }

    await prisma.shift_scooter_usages.delete({ where: { id } })

    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'SCOOTER_USAGE_DELETE',
      description: `Admin: eliminato record scooter ${id}`,
      metadata: { id, shiftId: existing.shiftId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting scooter usage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
