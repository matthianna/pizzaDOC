import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDayName } from '@/lib/utils'
import {
  appTodayCalendarDateKey,
  getWeekStart,
  shiftCalendarDateUtc,
  shiftInstantRome,
  utcCalendarDateKey,
} from '@/lib/date-utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const todayKey = appTodayCalendarDateKey()

    // Usa getWeekStart per calcolare correttamente l'inizio della settimana
    const startOfWeek = getWeekStart(new Date())

    // Trova i turni dell'utente FUTURI (dalla settimana corrente in poi)
    const myShifts = await prisma.shifts.findMany({
      where: {
        userId: session.user.id,
        schedules: {
          weekStart: {
            gte: startOfWeek
          }
        }
      },
      include: {
        schedules: true
      }
      // NON ordiniamo qui perché Prisma non può ordinare per campi nested
    })

    // Trasforma i turni in un formato più leggibile e filtra solo i FUTURI
    const formattedShifts = myShifts
      .map((shift) => {
        const shiftDayUtc = shiftCalendarDateUtc(shift.schedules.weekStart, shift.dayOfWeek)
        const startInst = shiftInstantRome(shiftDayUtc, shift.startTime)

        const dayName = getDayName(shift.dayOfWeek)
        const dateStr = shiftDayUtc.toISOString()

        return {
          id: shift.id,
          dayOfWeek: shift.dayOfWeek,
          dayName,
          date: dateStr,
          shiftType: shift.shiftType,
          role: shift.role,
          startTime: shift.startTime,
          endTime: shift.endTime,
          isToday: utcCalendarDateKey(shiftDayUtc) === todayKey,
          isPast: startInst.getTime() < Date.now(),
          shiftDateObj: shiftDayUtc,
          _sortTime: startInst.getTime(),
        }
      })
      .filter((shift) => !shift.isPast)
      .sort((a, b) => {
        const t = a._sortTime - b._sortTime
        if (t !== 0) return t
        return a.shiftType === 'PRANZO' ? -1 : 1
      })
      .slice(0, 10)
      .map(({ shiftDateObj, _sortTime, ...shift }) => shift)

    return NextResponse.json({
      shifts: formattedShifts,
      total: formattedShifts.length
    })
  } catch (error) {
    console.error('Error fetching my shifts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
