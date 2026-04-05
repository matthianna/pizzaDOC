import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT - Update rejected worked hours
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params
    
    if (!session || !session.user.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { shiftId, startTime, endTime, totalHours } = await request.json()

    if (!shiftId || !startTime || !endTime || typeof totalHours !== 'number') {
      return NextResponse.json(
        { error: 'Dati obbligatori mancanti' },
        { status: 400 }
      )
    }

    const existingWorkedHours = await prisma.worked_hours.findFirst({
      where: {
        id: id,
        userId: session.user.id,
        status: 'REJECTED',
      },
    })

    if (!existingWorkedHours) {
      return NextResponse.json(
        {
          error:
            'Registrazione ore non trovata o non è possibile modificarla (solo ore rifiutate possono essere corrette)',
        },
        { status: 404 }
      )
    }

    if (existingWorkedHours.shiftId !== shiftId) {
      return NextResponse.json(
        { error: 'Il turno non corrisponde alla richiesta' },
        { status: 400 }
      )
    }

    // Validate time format and logic
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { error: 'Formato orario non valido' },
        { status: 400 }
      )
    }

    // Handle overnight shifts (e.g., 22:00 to 00:30)
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    let endMinutes = endHour * 60 + endMin
    
    // If end time is earlier than start time, assume it's the next day
    if (endHour < startHour) {
      endMinutes += 24 * 60 // Add 24 hours
    }
    
    const calculatedMinutes = endMinutes - startMinutes
    const calculatedHours = Math.round((calculatedMinutes / 60) * 2) / 2

    if (calculatedHours <= 0) {
      return NextResponse.json(
        { error: 'Intervallo orario non valido' },
        { status: 400 }
      )
    }

    if (Math.abs(calculatedHours - totalHours) > 0.01) {
      return NextResponse.json(
        { error: 'Il totale ore non corrisponde agli orari inseriti' },
        { status: 400 }
      )
    }

    // Update worked hours record
    const updatedWorkedHours = await prisma.worked_hours.update({
      where: { id: id },
      data: {
        startTime,
        endTime,
        totalHours: calculatedHours,
        status: 'PENDING', // Reset to pending for re-approval
        rejectionReason: null, // Clear rejection reason
        submittedAt: new Date(),
        reviewedAt: null // Clear previous review
      }
    })

    return NextResponse.json({
      success: true,
      worked_hours: updatedWorkedHours
    })
  } catch (error) {
    console.error('Error updating worked hours:', error)
    return NextResponse.json(
      { error: 'Errore del server. Riprova più tardi.' },
      { status: 500 }
    )
  }
}
