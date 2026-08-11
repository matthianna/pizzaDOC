import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-logger'
import { getDayName, getRoleName, getShiftTypeName } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { shiftId, reason } = await request.json()

    if (!shiftId) {
      return NextResponse.json({ error: 'Missing shiftId' }, { status: 400 })
    }

    const shift = await prisma.shifts.findUnique({
      where: { id: shiftId },
      include: {
        user: {
          select: {
            username: true,
          },
        },
        schedules: {
          select: {
            weekStart: true,
          },
        },
      },
    })

    if (!shift) {
      return NextResponse.json({
        success: true,
        alreadyRemoved: true,
      })
    }

    await prisma.shifts.delete({
      where: { id: shiftId },
    })

    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'SHIFT_DELETE',
      description: `Rimosso turno di ${shift.user.username}: ${getDayName(shift.dayOfWeek)} ${getShiftTypeName(shift.shiftType)} · ${getRoleName(shift.role)}${reason ? ` (${reason})` : ''}`,
      metadata: {
        shiftId,
        targetUserId: shift.userId,
        targetUsername: shift.user.username,
        dayOfWeek: shift.dayOfWeek,
        shiftType: shift.shiftType,
        role: shift.role,
        startTime: shift.startTime,
        endTime: shift.endTime,
        weekStart: shift.schedules.weekStart,
        reason: reason || null,
      },
    })

    return NextResponse.json({
      success: true,
      username: shift.user.username,
    })
  } catch (error) {
    console.error('Error removing staff:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
