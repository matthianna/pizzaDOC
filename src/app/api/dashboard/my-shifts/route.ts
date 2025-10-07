import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { normalizeDate } from '@/lib/normalize-date'
import { getWeekStart } from '@/lib/date-utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = normalizeDate(new Date())
    
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
      .map(shift => {
        const weekStartDate = normalizeDate(shift.schedules.weekStart)
        // Usa UTC per calcolare la data del turno
        const shiftDate = new Date(Date.UTC(
          weekStartDate.getUTCFullYear(), 
          weekStartDate.getUTCMonth(), 
          weekStartDate.getUTCDate() + shift.dayOfWeek
        ))
        
        const dayName = format(shiftDate, 'EEEE', { locale: it })
        const dateStr = format(shiftDate, 'd MMMM', { locale: it })
        
        return {
          id: shift.id,
          dayOfWeek: shift.dayOfWeek,
          dayName,
          date: dateStr,
          shiftType: shift.shiftType,
          role: shift.role,
          startTime: shift.startTime,
          endTime: shift.endTime,
          isToday: shiftDate.toDateString() === today.toDateString(),
          isPast: shiftDate < today,
          shiftDateObj: shiftDate
        }
      })
      .filter(shift => !shift.isPast) // FILTRA SOLO TURNI FUTURI O OGGI
      .sort((a, b) => {
        // Ordina per data effettiva (prima per data, poi per tipo turno)
        const dateCompare = a.shiftDateObj.getTime() - b.shiftDateObj.getTime()
        if (dateCompare !== 0) return dateCompare
        // Se stesso giorno, PRANZO prima di CENA
        return a.shiftType === 'PRANZO' ? -1 : 1
      })
      .slice(0, 10) // Mostra max 10 turni prossimi
      .map(({ shiftDateObj, ...shift }) => shift) // Rimuovi shiftDateObj dal risultato

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
