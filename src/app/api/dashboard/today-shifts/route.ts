import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfWeek, format } from 'date-fns'
import { convertJsDayToOurDay } from '@/lib/date-utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    const jsDay = today.getDay() // JavaScript: 0=Sunday, 1=Monday, etc.
    const dayOfWeek = convertJsDayToOurDay(jsDay) // Our system: 0=Monday, 1=Tuesday, ..., 6=Sunday
    
    // Calcola l'inizio della settimana corrente (lunedì)
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 })
    currentWeekStart.setHours(0, 0, 0, 0) // Normalizza ora

    console.log('Today shifts debug:', {
      today: format(today, 'yyyy-MM-dd HH:mm'),
      dayOfWeek,
      weekStart: format(currentWeekStart, 'yyyy-MM-dd')
    })

    // Trova i turni di oggi
    const todayShifts = await prisma.shift.findMany({
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
            userTransports: {
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
