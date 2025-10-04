import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format, addDays } from 'date-fns'
import { it } from 'date-fns/locale'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Trova tutti i turni dell'utente dalla settimana corrente in poi
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    startOfWeek.setHours(0, 0, 0, 0)

    const myShifts = await prisma.shift.findMany({
      where: {
        userId: session.user.id,
        schedule: {
          weekStart: {
            gte: startOfWeek
          }
        }
      },
      include: {
        schedule: true
      },
      orderBy: [
        { schedule: { weekStart: 'asc' } },
        { dayOfWeek: 'asc' },
        { shiftType: 'asc' }
      ],
      take: 10 // Limita ai prossimi 10 turni
    })

    // Trasforma i turni in un formato più leggibile e filtra solo i futuri
    const formattedShifts = myShifts
      .map(shift => {
        const weekStart = new Date(shift.schedule.weekStart)
        const shiftDate = addDays(weekStart, shift.dayOfWeek)
        
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
          shiftDate: shiftDate,
          isToday: shiftDate.toDateString() === today.toDateString(),
          isPast: shiftDate < today
        }
      })
      .filter(shift => !shift.isPast) // Filtra solo i turni futuri o di oggi
      .map(({ shiftDate, ...rest }) => rest) // Rimuovi shiftDate dal risultato finale

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
