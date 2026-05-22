import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import { ensureUtcMondayWeekStart, shiftCalendarDateUtc } from '@/lib/date-utils'
import { resolveScheduleForRequestedWeek } from '@/lib/resolve-schedule-for-week'
import { logAuditAction } from '@/lib/audit-logger'
import { v4 as uuidv4 } from 'uuid'
import {
  shiftRequiresScooterLog,
  isShiftEndedForLog,
  getMaxScooterCount,
  validateScooterNumber,
  checkScooterConflict,
  userUsesScooterTransport,
  isExcludedFromScooterLog,
  getScooterRegistrationStartDateKey,
} from '@/lib/scooter-usage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const weekStartParam = request.nextUrl.searchParams.get('weekStart')
    if (!weekStartParam) {
      return NextResponse.json({ error: 'weekStart is required' }, { status: 400 })
    }

    const weekStart = normalizeDate(weekStartParam)
    const dayMs = 24 * 60 * 60 * 1000
    const weekStartCandidates = [
      normalizeDate(new Date(weekStart.getTime() - dayMs)),
      weekStart,
      normalizeDate(new Date(weekStart.getTime() + dayMs)),
    ]

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        username: true,
        primaryTransport: true,
        user_transports: { select: { transport: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const eligible =
      !isExcludedFromScooterLog(user.username) && userUsesScooterTransport(user)
    const maxScooters = await getMaxScooterCount()

    const scheduleRows = await prisma.schedules.findMany({
      where: { weekStart: { in: weekStartCandidates } },
      include: {
        shifts: {
          where: { userId: session.user.id },
          include: {
            shift_scooter_usages: {
              select: { id: true, scooterNumber: true, usedAuto: true, recordedAt: true },
            },
          },
          orderBy: [{ dayOfWeek: 'asc' }, { shiftType: 'asc' }],
        },
      },
    })

    const schedule =
      scheduleRows.length === 0
        ? null
        : resolveScheduleForRequestedWeek(scheduleRows, weekStart)

    const displayWeekStart = ensureUtcMondayWeekStart(schedule?.weekStart ?? weekStart)

    if (!schedule) {
      return NextResponse.json({
        weekStart: displayWeekStart.toISOString(),
        eligible,
        maxScooters,
        registrationStartDate: getScooterRegistrationStartDateKey(),
        shifts: [],
      })
    }

    const shifts = schedule.shifts.map((shift) => {
      const requiresScooterLog = shiftRequiresScooterLog(shift, user, displayWeekStart)
      const isEnded = isShiftEndedForLog(shift, displayWeekStart)
      const shiftDate = shiftCalendarDateUtc(displayWeekStart, shift.dayOfWeek)

      return {
        id: shift.id,
        dayOfWeek: shift.dayOfWeek,
        shiftType: shift.shiftType,
        role: shift.role,
        startTime: shift.startTime,
        endTime: shift.endTime,
        requiresScooterLog,
        isEnded,
        shiftDate: shiftDate.toISOString(),
        scooterUsage: shift.shift_scooter_usages
          ? {
              id: shift.shift_scooter_usages.id,
              scooterNumber: shift.shift_scooter_usages.scooterNumber,
              usedAuto: shift.shift_scooter_usages.usedAuto,
              recordedAt: shift.shift_scooter_usages.recordedAt.toISOString(),
            }
          : null,
      }
    })

    return NextResponse.json({
      weekStart: displayWeekStart.toISOString(),
      eligible,
      maxScooters,
      registrationStartDate: getScooterRegistrationStartDateKey(),
      shifts,
    })
  } catch (error) {
    console.error('Error fetching user scooter usage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { shiftId, scooterNumber, usedAuto } = await request.json()
    if (!shiftId) {
      return NextResponse.json({ error: 'shiftId è obbligatorio' }, { status: 400 })
    }

    const workedByCar = usedAuto === true
    if (!workedByCar && scooterNumber == null) {
      return NextResponse.json(
        { error: 'Seleziona uno scooter o indica che hai lavorato in auto' },
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
        schedules: { select: { weekStart: true, id: true } },
        user: {
          select: {
            id: true,
            username: true,
            primaryTransport: true,
            user_transports: { select: { transport: true } },
          },
        },
        shift_scooter_usages: true,
      },
    })

    if (!shift || shift.userId !== session.user.id) {
      return NextResponse.json({ error: 'Turno non trovato' }, { status: 404 })
    }

    const weekStart = ensureUtcMondayWeekStart(shift.schedules.weekStart)
    if (!shiftRequiresScooterLog(shift, shift.user, weekStart)) {
      return NextResponse.json(
        { error: 'Non devi registrare l\'utilizzo scooter per questo turno' },
        { status: 403 }
      )
    }

    if (!isShiftEndedForLog(shift, weekStart)) {
      return NextResponse.json(
        { error: 'Puoi registrare lo scooter solo dopo la fine del turno' },
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
        description: workedByCar
          ? `Registrato lavoro in auto per turno ${shiftId}`
          : `Modificato scooter ${scooterNumber} per turno ${shiftId}`,
        metadata: { shiftId, scooterNumber: usageData.scooterNumber, usedAuto: workedByCar },
      })
    } else {
      record = await prisma.shift_scooter_usages.create({
        data: {
          id: uuidv4(),
          shiftId,
          userId: session.user.id,
          ...usageData,
        },
      })
      await logAuditAction({
        userId: session.user.id,
        userUsername: session.user.username,
        action: 'SCOOTER_USAGE_CREATE',
        description: workedByCar
          ? `Registrato lavoro in auto per turno ${shiftId}`
          : `Registrato scooter ${scooterNumber} per turno ${shiftId}`,
        metadata: { shiftId, scooterNumber: usageData.scooterNumber, usedAuto: workedByCar },
      })
    }

    return NextResponse.json({
      usage: record,
      warning: conflictWarning,
    })
  } catch (error) {
    console.error('Error saving scooter usage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
