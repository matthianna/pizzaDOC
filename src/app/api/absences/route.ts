import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, isBefore } from 'date-fns'

// GET - Ottieni tutte le assenze dell'utente corrente
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const absences = await prisma.absence.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        startDate: 'desc'
      }
    })

    return NextResponse.json(absences)
  } catch (error) {
    console.error('Error fetching absences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Crea nuova assenza
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { startDate, endDate, reason, type } = body

    // Validazioni
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const start = startOfDay(new Date(startDate))
    const end = endOfDay(new Date(endDate))
    const today = startOfDay(new Date())

    // Non si può creare assenza nel passato
    if (isBefore(start, today)) {
      return NextResponse.json(
        { error: 'Cannot create absence in the past' },
        { status: 400 }
      )
    }

    // La data di fine deve essere dopo o uguale alla data di inizio
    if (isBefore(end, start)) {
      return NextResponse.json(
        { error: 'End date must be after or equal to start date' },
        { status: 400 }
      )
    }

    // Controlla sovrapposizioni con altre assenze
    const overlappingAbsences = await prisma.absence.findMany({
      where: {
        userId: session.user.id,
        status: 'APPROVED',
        OR: [
          {
            AND: [
              { startDate: { lte: end } },
              { endDate: { gte: start } }
            ]
          }
        ]
      }
    })

    if (overlappingAbsences.length > 0) {
      return NextResponse.json(
        { error: 'There is already an approved absence in this date range' },
        { status: 400 }
      )
    }

    const absence = await prisma.absence.create({
      data: {
        userId: session.user.id,
        startDate: start,
        endDate: end,
        reason,
        type: type || 'VACATION',
        status: 'APPROVED' // Auto-approvato per ora
      }
    })

    return NextResponse.json(absence)
  } catch (error) {
    console.error('Error creating absence:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
