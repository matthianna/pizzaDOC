import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    startOfWeek.setHours(0, 0, 0, 0)

    // Trova i turni dell'utente FUTURI (dalla settimana corrente in poi)
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
        { dayOfWeek: 'asc' },
        { shiftType: 'asc' }
      ]
    })

    // Trasforma i turni in un formato più leggibile e filtra solo i FUTURI
    const formattedShifts = myShifts
      .map(shift => {
        const weekStartDate = new Date(shift.schedule.weekStart)
        const shiftDate = new Date(weekStartDate)
        shiftDate.setDate(weekStartDate.getDate() + shift.dayOfWeek)
        shiftDate.setHours(0, 0, 0, 0)
        
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
