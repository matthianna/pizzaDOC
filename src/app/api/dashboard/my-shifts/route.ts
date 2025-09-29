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
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    startOfWeek.setHours(0, 0, 0, 0)

    // Trova i turni dell'utente per questa settimana
    const myShifts = await prisma.shift.findMany({
      where: {
        userId: session.user.id,
        schedule: {
          weekStart: {
            gte: startOfWeek,
            lt: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)
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

    // Trasforma i turni in un formato più leggibile
    const formattedShifts = myShifts.map(shift => {
      const shiftDate = new Date(startOfWeek)
      shiftDate.setDate(startOfWeek.getDate() + shift.dayOfWeek)
      
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
        isPast: shiftDate < today
      }
    })

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
