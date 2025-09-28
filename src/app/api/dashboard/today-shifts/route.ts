import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.
    
    // Calcola l'inizio della settimana (lunedì)
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    startOfWeek.setHours(0, 0, 0, 0)

    // Trova i turni di oggi
    const todayShifts = await prisma.shift.findMany({
      where: {
        dayOfWeek: dayOfWeek,
        schedule: {
          weekStart: {
            gte: startOfWeek,
            lt: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000) // Fine settimana
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
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
