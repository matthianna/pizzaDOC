import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { convertJsDayToOurDay, getWeekStart } from '@/lib/date-utils'
import { normalizeDate } from '@/lib/normalize-date'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Usa UTC per consistenza con tutto il resto dell'app
    const now = new Date()
    const today = normalizeDate(now)
    
    const jsDay = today.getUTCDay() // JavaScript: 0=Sunday, 1=Monday, etc. in UTC
    const dayOfWeek = convertJsDayToOurDay(jsDay) // Our system: 0=Monday, 1=Tuesday, ..., 6=Sunday
    
    // Calcola l'inizio della settimana corrente (lunedì) - USA getWeekStart per evitare bug timezone
    const currentWeekStart = getWeekStart(now)

    console.log('Today shifts debug:', {
      utcNow: format(now, 'yyyy-MM-dd HH:mm'),
      todayNormalized: format(today, 'yyyy-MM-dd'),
      dayOfWeek,
      jsDay,
      weekStart: format(currentWeekStart, 'yyyy-MM-dd'),
      weekStartISO: currentWeekStart.toISOString(),
      weekStartTimestamp: currentWeekStart.getTime()
    })

    // DEBUG: Verifica quali schedules esistono nel database
    const allSchedules = await prisma.schedules.findMany({
      select: {
        weekStart: true,
        _count: {
          select: { shifts: true }
        }
      }
    })
    console.log('All schedules in DB:', allSchedules.map(s => ({
      weekStart: format(new Date(s.weekStart), 'yyyy-MM-dd'),
      weekStartISO: new Date(s.weekStart).toISOString(),
      weekStartTimestamp: new Date(s.weekStart).getTime(),
      shiftsCount: s._count.shifts
    })))

    // DEBUG: Verifica tutti i turni per il dayOfWeek corrente
    const allShiftsForDay = await prisma.shifts.findMany({
      where: { dayOfWeek },
      include: { schedules: { select: { weekStart: true } } },
      take: 10
    })
    console.log(`All shifts for dayOfWeek=${dayOfWeek}:`, allShiftsForDay.map(s => ({
      weekStart: format(new Date(s.schedules.weekStart), 'yyyy-MM-dd'),
      shiftType: s.shiftType,
      role: s.role
    })))

    // Trova i turni di oggi
    // Usa un range per il weekStart per gestire differenze di timezone
    const nextWeekStart = new Date(currentWeekStart)
    nextWeekStart.setDate(nextWeekStart.getDate() + 7)
    
    const todayShifts = await prisma.shifts.findMany({
      where: {
        dayOfWeek: dayOfWeek,
        schedules: {
          weekStart: {
            gte: currentWeekStart,
            lt: nextWeekStart
          }
        }
      },
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
        },
        schedules: true
      },
      orderBy: [
        { shiftType: 'asc' },
        { role: 'asc' }
      ]
    })
    
    console.log(`Found ${todayShifts.length} shifts for today`)

    // Raggruppa per tipo di turno
    const groupedShifts = todayShifts.reduce((acc, shift) => {
      const key = shift.shiftType
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(shift)
      return acc
    }, {} as Record<string, typeof todayShifts>)

    return NextResponse.json({
      date: today.toISOString(),
      dayOfWeek,
      shifts: groupedShifts,
      totalWorkers: todayShifts.length
    })
  } catch (error) {
    console.error('Error fetching today shifts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
