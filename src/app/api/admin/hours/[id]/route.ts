import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { startTime, endTime } = await request.json()

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'Orari di inizio e fine sono richiesti' },
        { status: 400 }
      )
    }

    // Valida formato orario (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { error: 'Formato orario non valido. Usa HH:MM' },
        { status: 400 }
      )
    }

    // Calcola nuove ore totali
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    let totalHours = (endHour + endMin / 60) - (startHour + startMin / 60)
    if (totalHours < 0) {
      totalHours += 24 // Gestisce turni che attraversano la mezzanotte
    }

    if (totalHours <= 0 || totalHours > 24) {
      return NextResponse.json(
        { error: 'Le ore totali devono essere tra 0 e 24' },
        { status: 400 }
      )
    }

    const updatedHours = await prisma.worked_hours.update({
      where: { id },
      data: {
        startTime,
        endTime,
        totalHours,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        },
        shifts: {
          include: {
            schedules: true
          }
        }
      }
    })

    return NextResponse.json(updatedHours)
  } catch (error: any) {
    console.error('Error updating worked hours:', error)
    return NextResponse.json(
      { error: error.message || 'Errore durante l\'aggiornamento' },
      { status: 500 }
    )
  }
}

