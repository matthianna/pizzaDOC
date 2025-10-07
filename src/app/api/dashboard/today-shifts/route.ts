import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek, format } from 'date-fns'
import { convertJsDayToOurDay } from '@/lib/date-utils'
import { normalizeDate } from '@/lib/normalize-date'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // NORMALIZZA LA DATA al fuso orario italiano (Europe/Rome) per evitare problemi su Vercel
    const now = new Date()
    // Ottieni la data nel fuso orario italiano
    const italianDateString = now.toLocaleString('en-US', { timeZone: 'Europe/Rome' })
    const italianDate = new Date(italianDateString)
    
    const jsDay = italianDate.getDay() // JavaScript: 0=Sunday, 1=Monday, etc.
    const dayOfWeek = convertJsDayToOurDay(jsDay) // Our system: 0=Monday, 1=Tuesday, ..., 6=Sunday
    
    // Calcola l'inizio della settimana corrente (lunedì) con la data italiana
    const currentWeekStartRaw = startOfWeek(italianDate, { weekStartsOn: 1 })
    // NORMALIZZA la data per matching con il database (rimuove timezone)
    const currentWeekStart = normalizeDate(currentWeekStartRaw)

    console.log('Today shifts debug:', {
      utcNow: format(now, 'yyyy-MM-dd HH:mm'),
      italianDate: format(italianDate, 'yyyy-MM-dd HH:mm'),
      dayOfWeek,
      jsDay,
      weekStart: format(currentWeekStart, 'yyyy-MM-dd')
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
      shiftsCount: s._count.shifts
    })))

    // DEBUG: Verifica tutti i turni per il dayOfWeek corrente
    const allShiftsForDay = await prisma.shifts.findMany({
      where: { dayOfWeek },
      include: { schedule: { select: { weekStart: true } } },
      take: 10
    })
    console.log(`All shifts for dayOfWeek=${dayOfWeek}:`, allShiftsForDay.map(s => ({
      weekStart: format(new Date(s.schedule.weekStart), 'yyyy-MM-dd'),
      shiftType: s.shiftType,
      role: s.role
    })))

    // Trova i turni di oggi
    const todayShifts = await prisma.shifts.findMany({
      where: {
        dayOfWeek: dayOfWeek,
        schedule: {
          weekStart: currentWeekStart
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
        schedule: true
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
      date: italianDate.toISOString(),
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
