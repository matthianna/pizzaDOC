import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

// GET - Controlla se l'utente è in assenza per una data specifica
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    if (!dateParam) {
      return NextResponse.json(
        { error: 'Date parameter required' },
        { status: 400 }
      )
    }

    const checkDate = new Date(dateParam)
    const dayStart = startOfDay(checkDate)
    const dayEnd = endOfDay(checkDate)

    // Trova assenze che includono questa data
    const absences = await prisma.absence.findMany({
      where: {
        userId: session.user.id,
        status: 'APPROVED',
        startDate: { lte: dayEnd },
        endDate: { gte: dayStart }
      }
    })

    return NextResponse.json({
      isAbsent: absences.length > 0,
      absences: absences
    })
  } catch (error) {
    console.error('Error checking absence:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
