import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import { ensureUtcMondayWeekStart } from '@/lib/date-utils'
import { resolveScheduleForRequestedWeek } from '@/lib/resolve-schedule-for-week'
import { shiftRequiresScooterLog } from '@/lib/scooter-usage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'Week start parameter is required' }, { status: 400 })
    }

    const weekStart = normalizeDate(weekStartParam)

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        username: true,
        primaryTransport: true,
        user_transports: { select: { transport: true } },
      },
    })

    const dayMs = 24 * 60 * 60 * 1000
    const weekStartCandidates = [
      normalizeDate(new Date(weekStart.getTime() - dayMs)),
      weekStart,
      normalizeDate(new Date(weekStart.getTime() + dayMs)),
    ]

    const scheduleRows = await prisma.schedules.findMany({
      where: { weekStart: { in: weekStartCandidates } },
      include: {
        shifts: {
          where: {
            userId: session.user.id
          },
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            },
            schedules: {
              select: { weekStart: true }
            },
            worked_hours: {
              select: {
                id: true,
                status: true,
                totalHours: true
              }
            },
            shift_scooter_usages: {
              select: {
                id: true,
                scooterNumber: true,
                usedAuto: true,
                recordedAt: true
              }
            }
          },
          orderBy: [
            { dayOfWeek: 'asc' },
            { shiftType: 'asc' }
          ]
        }
      }
    })

    const schedule =
      scheduleRows.length === 0
        ? null
        : resolveScheduleForRequestedWeek(scheduleRows, weekStart)

    const displayWeekStart = ensureUtcMondayWeekStart(schedule?.weekStart ?? weekStart)

    if (!schedule) {
      return NextResponse.json(
        { shifts: [], weekStart: displayWeekStart.toISOString() },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      )
    }

    const shiftsWithMappedHours = schedule.shifts.map((shift: any) => ({
      ...shift,
      workedHours: shift.worked_hours,
      scooterUsage: shift.shift_scooter_usages
        ? {
            id: shift.shift_scooter_usages.id,
            scooterNumber: shift.shift_scooter_usages.scooterNumber,
            usedAuto: shift.shift_scooter_usages.usedAuto,
            recordedAt: shift.shift_scooter_usages.recordedAt,
          }
        : null,
      requiresScooterLog: currentUser
        ? shiftRequiresScooterLog(
            shift,
            currentUser,
            shift.schedules?.weekStart
              ? ensureUtcMondayWeekStart(shift.schedules.weekStart)
              : displayWeekStart
          )
        : false,
      schedule: { weekStart: displayWeekStart.toISOString() }
    }))

    return NextResponse.json(
      { shifts: shiftsWithMappedHours, weekStart: displayWeekStart.toISOString() },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching user schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
