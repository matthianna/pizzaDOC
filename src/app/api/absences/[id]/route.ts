import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, isBefore } from 'date-fns'

// PUT - Aggiorna assenza
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const absenceId = resolvedParams.id

    // Controlla che l'assenza esista e appartenga all'utente
    const existingAbsence = await prisma.absence.findUnique({
      where: { id: absenceId }
    })

    if (!existingAbsence) {
      return NextResponse.json(
        { error: 'Absence not found' },
        { status: 404 }
      )
    }

    if (existingAbsence.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Non si possono modificare assenze nel passato
    if (isBefore(endOfDay(existingAbsence.endDate), startOfDay(new Date()))) {
      return NextResponse.json(
        { error: 'Cannot modify past absences' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { startDate, endDate, reason, type } = body

    const start = startOfDay(new Date(startDate))
    const end = endOfDay(new Date(endDate))
    const today = startOfDay(new Date())

    // Validazioni
    if (isBefore(start, today)) {
      return NextResponse.json(
        { error: 'Cannot create absence in the past' },
        { status: 400 }
      )
    }

    if (isBefore(end, start)) {
      return NextResponse.json(
        { error: 'End date must be after or equal to start date' },
        { status: 400 }
      )
    }

    // Controlla sovrapposizioni (escludi l'assenza corrente)
    const overlappingAbsences = await prisma.absence.findMany({
      where: {
        userId: session.user.id,
        status: 'APPROVED',
        id: { not: absenceId },
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

    const updatedAbsence = await prisma.absence.update({
      where: { id: absenceId },
      data: {
        startDate: start,
        endDate: end,
        reason,
        type: type || existingAbsence.type
      }
    })

    return NextResponse.json(updatedAbsence)
  } catch (error) {
    console.error('Error updating absence:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Elimina assenza
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const absenceId = resolvedParams.id

    // Controlla che l'assenza esista e appartenga all'utente
    const existingAbsence = await prisma.absence.findUnique({
      where: { id: absenceId }
    })

    if (!existingAbsence) {
      return NextResponse.json(
        { error: 'Absence not found' },
        { status: 404 }
      )
    }

    if (existingAbsence.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Non si possono eliminare assenze nel passato
    if (isBefore(endOfDay(existingAbsence.endDate), startOfDay(new Date()))) {
      return NextResponse.json(
        { error: 'Cannot delete past absences' },
        { status: 400 }
      )
    }

    await prisma.absence.delete({
      where: { id: absenceId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting absence:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
