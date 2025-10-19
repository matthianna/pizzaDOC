import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addDays, startOfWeek, isBefore } from 'date-fns'

/**
 * GET /api/dashboard/missing-hours
 * Trova turni completati dall'utente per i quali non sono state inserite le ore
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verifica se l'utente ha trackHours abilitato
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { trackHours: true }
    })

    // Se l'utente non ha trackHours abilitato, ritorna array vuoto
    if (!user || !user.trackHours) {
      return NextResponse.json({
        missingShifts: [],
        count: 0
      })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Trova tutti i turni dell'utente fino a oggi
    const shifts = await prisma.shifts.findMany({
      where: {
        userId: session.user.id,
        schedules: {
          weekStart: {
            lte: today
          }
        }
      },
      include: {
        schedules: {
          select: {
            weekStart: true
          }
        },
        worked_hours: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        schedules: {
          weekStart: 'desc'
        }
      }
    })

    // Filtra solo i turni che sono già passati e non hanno ore inserite
    const missingShifts = shifts.filter(shift => {
      // Calcola la data del turno
      const weekStart = shift.schedules.weekStart instanceof Date 
        ? shift.schedules.weekStart 
        : new Date(shift.schedules.weekStart)
      const shiftDate = addDays(weekStart, shift.dayOfWeek)
      shiftDate.setHours(23, 59, 59, 999)

      // Il turno è passato?
      const isPast = isBefore(shiftDate, today)

      // Non ha ore inserite? (worked_hours è opzionale, non un array)
      const hasNoHours = !shift.worked_hours

      return isPast && hasNoHours
    })

    // Formatta i dati per il frontend
    const formattedShifts = missingShifts.map(shift => {
      const weekStart = shift.schedules.weekStart instanceof Date 
        ? shift.schedules.weekStart 
        : new Date(shift.schedules.weekStart)
      const shiftDate = addDays(weekStart, shift.dayOfWeek)

      return {
        id: shift.id,
        date: shiftDate.toISOString(),
        dayOfWeek: shift.dayOfWeek,
        shiftType: shift.shiftType,
        role: shift.role,
        startTime: shift.startTime,
        endTime: shift.endTime
      }
    })

    // Limita agli ultimi 10 turni mancanti più recenti
    const recentMissing = formattedShifts.slice(0, 10)

    return NextResponse.json({
      missingShifts: recentMissing,
      count: formattedShifts.length
    })
  } catch (error) {
    console.error('Error fetching missing hours:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

