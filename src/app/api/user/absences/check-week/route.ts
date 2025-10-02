import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/user/absences/check-week - Check which days are covered by absences
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')

    if (!weekStartParam) {
      return NextResponse.json(
        { error: 'weekStart parameter required' },
        { status: 400 }
      )
    }

    const weekStart = new Date(weekStartParam)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    // Trova assenze che si sovrappongono con questa settimana
    const absences = await prisma.absence.findMany({
      where: {
        userId: session.user.id,
        OR: [
          {
            AND: [
              { startDate: { lte: weekEnd } },
              { endDate: { gte: weekStart } }
            ]
          }
        ]
      }
    })

    // Crea un array di date per ogni giorno della settimana
    const disabledDays: number[] = []
    
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(weekStart)
      currentDay.setDate(currentDay.getDate() + i)
      currentDay.setHours(0, 0, 0, 0)
      
      // Controlla se questo giorno è coperto da un'assenza
      const isDayDisabled = absences.some(absence => {
        const start = new Date(absence.startDate)
        const end = new Date(absence.endDate)
        start.setHours(0, 0, 0, 0)
        end.setHours(0, 0, 0, 0)
        
        return currentDay >= start && currentDay <= end
      })
      
      if (isDayDisabled) {
        disabledDays.push(i) // i = dayOfWeek (0=Monday)
      }
    }

    return NextResponse.json({
      disabledDays,
      hasAbsences: disabledDays.length > 0,
      absences: absences.map(a => ({
        id: a.id,
        startDate: a.startDate,
        endDate: a.endDate,
        reason: a.reason
      }))
    })
  } catch (error) {
    console.error('Error checking absences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
