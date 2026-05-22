import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import { ensureUtcMondayWeekStart, shiftCalendarDateUtc } from '@/lib/date-utils'
import { logAuditAction } from '@/lib/audit-logger'
import { v4 as uuidv4 } from 'uuid'
import {
  getMaxScooterCount,
  validateScooterNumber,
  shiftRequiresScooterLog,
  checkScooterConflict,
} from '@/lib/scooter-usage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.roles?.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const weekStartParam = searchParams.get('weekStart')
    const userId = searchParams.get('userId')
    const scooterNumberParam = searchParams.get('scooterNumber')

    const where: Record<string, unknown> = {}

    if (userId) where.userId = userId
    if (scooterNumberParam) where.scooterNumber = parseInt(scooterNumberParam, 10)

    if (weekStartParam) {
      const weekStart = normalizeDate(weekStartParam)
      const dayMs = 24 * 60 * 60 * 1000
      const candidates = [
        normalizeDate(new Date(weekStart.getTime() - dayMs)),
        weekStart,
        normalizeDate(new Date(weekStart.getTime() + dayMs)),
      ]
      where.shifts = { schedules: { weekStart: { in: candidates } } }
    }

    const records = await prisma.shift_scooter_usages.findMany({
      where,
      include: {
        user: { select: { id: true, username: true } },
        shifts: {
          include: {
            schedules: { select: { weekStart: true } },
          },
        },
      },
      orderBy: { recordedAt: 'desc' },
    })

    const items = records.map((r) => {
      const ws = ensureUtcMondayWeekStart(r.shifts.schedules.weekStart)
      const shiftDate = shiftCalendarDateUtc(ws, r.shifts.dayOfWeek)
      return {
        id: r.id,
        shiftId: r.shiftId,
        userId: r.userId,
        username: r.user.username,
        scooterNumber: r.scooterNumber,
        usedAuto: r.usedAuto,
        recordedAt: r.recordedAt.toISOString(),
        weekStart: ws.toISOString(),
        shiftDate: shiftDate.toISOString(),
        dayOfWeek: r.shifts.dayOfWeek,
        shiftType: r.shifts.shiftType,
        role: r.shifts.role,
        startTime: r.shifts.startTime,
        endTime: r.shifts.endTime,
      }
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('Error fetching admin scooter usage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.roles?.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { shiftId, userId, scooterNumber, usedAuto } = await request.json()
    if (!shiftId || !userId) {
      return NextResponse.json(
        { error: 'shiftId e userId sono obbligatori' },
        { status: 400 }
      )
    }

    const workedByCar = usedAuto === true
    if (!workedByCar && scooterNumber == null) {
      return NextResponse.json(
        { error: 'Indica uno scooter o usedAuto' },
        { status: 400 }
      )
    }

    const maxScooters = await getMaxScooterCount()
    if (!workedByCar) {
      const validationError = validateScooterNumber(Number(scooterNumber), maxScooters)
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 })
      }
    }

    const shift = await prisma.shifts.findUnique({
      where: { id: shiftId },
      include: {
        schedules: { select: { id: true, weekStart: true } },
        user: {
          select: {
            primaryTransport: true,
            user_transports: { select: { transport: true } },
          },
        },
        shift_scooter_usages: true,
      },
    })

    if (!shift) {
      return NextResponse.json({ error: 'Turno non trovato' }, { status: 404 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        primaryTransport: true,
        user_transports: { select: { transport: true } },
      },
    })

    if (!targetUser || !shiftRequiresScooterLog(shift, targetUser)) {
      return NextResponse.json(
        { error: 'L\'utente non è idoneo alla registrazione scooter per questo turno' },
        { status: 400 }
      )
    }

    const conflictWarning = workedByCar
      ? null
      : await checkScooterConflict(
          shiftId,
          shift.schedules.id,
          shift.dayOfWeek,
          shift.shiftType,
          Number(scooterNumber)
        )

    const now = new Date()
    const usageData = {
      userId,
      scooterNumber: workedByCar ? null : Number(scooterNumber),
      usedAuto: workedByCar,
      recordedAt: now,
      updatedAt: now,
    }
    let record

    if (shift.shift_scooter_usages) {
      record = await prisma.shift_scooter_usages.update({
        where: { id: shift.shift_scooter_usages.id },
        data: usageData,
      })
      await logAuditAction({
        userId: session.user.id,
        userUsername: session.user.username,
        action: 'SCOOTER_USAGE_EDIT',
        description: `Admin: modificato scooter ${scooterNumber} per ${shiftId}`,
        metadata: { shiftId, userId, scooterNumber },
      })
    } else {
      record = await prisma.shift_scooter_usages.create({
        data: {
          id: uuidv4(),
          shiftId,
          ...usageData,
        },
      })
      await logAuditAction({
        userId: session.user.id,
        userUsername: session.user.username,
        action: 'SCOOTER_USAGE_CREATE',
        description: `Admin: registrato scooter ${scooterNumber} per ${shiftId}`,
        metadata: { shiftId, userId, scooterNumber },
      })
    }

    return NextResponse.json({ usage: record, warning: conflictWarning }, { status: 201 })
  } catch (error) {
    console.error('Error creating admin scooter usage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
