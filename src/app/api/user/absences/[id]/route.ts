import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAuthenticatedWithRoles } from '@/lib/auth-utils'

// PUT /api/user/absences/[id] - Update user's absence
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isAuthenticatedWithRoles(session, ['ADMIN', 'FATTORINO', 'CUCINA', 'SALA', 'PIZZAIOLO'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const absenceId = resolvedParams.id

    // Verifica che l'assenza appartenga all'utente
    const existingAbsence = await prisma.absence.findFirst({
      where: {
        id: absenceId,
        userId: session.user.id
      }
    })

    if (!existingAbsence) {
      return NextResponse.json({ error: 'Absence not found' }, { status: 404 })
    }

    // Non si possono modificare assenze nel passato
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (existingAbsence.startDate < today) {
      return NextResponse.json(
        { error: 'Cannot modify past absences' },
        { status: 400 }
      )
    }

    const { type, startDate, endDate, reason } = await request.json()

    if (!type || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Type, start date, and end date are required' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    // Non si possono creare assenze nel passato
    if (start < today) {
      return NextResponse.json(
        { error: 'Cannot set absence for past dates' },
        { status: 400 }
      )
    }

    // Data fine deve essere >= data inizio
    if (end < start) {
      return NextResponse.json(
        { error: 'End date must be on or after start date' },
        { status: 400 }
      )
    }

    // Verifica sovrapposizioni (escludendo l'assenza corrente)
    const overlappingAbsences = await prisma.absence.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['PENDING', 'APPROVED'] },
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
        { error: 'Dates overlap with existing absence' },
        { status: 400 }
      )
    }

    const updatedAbsence = await prisma.absence.update({
      where: { id: absenceId },
      data: {
        type,
        startDate: start,
        endDate: end,
        reason
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

// DELETE /api/user/absences/[id] - Delete user's absence
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isAuthenticatedWithRoles(session, ['ADMIN', 'FATTORINO', 'CUCINA', 'SALA', 'PIZZAIOLO'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const absenceId = resolvedParams.id

    // Verifica che l'assenza appartenga all'utente
    const existingAbsence = await prisma.absence.findFirst({
      where: {
        id: absenceId,
        userId: session.user.id
      }
    })

    if (!existingAbsence) {
      return NextResponse.json({ error: 'Absence not found' }, { status: 404 })
    }

    // Non si possono eliminare assenze nel passato
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (existingAbsence.startDate < today) {
      return NextResponse.json(
        { error: 'Cannot delete past absences' },
        { status: 400 }
      )
    }

    await prisma.absence.delete({
      where: { id: absenceId }
    })

    return NextResponse.json({ message: 'Absence deleted successfully' })
  } catch (error) {
    console.error('Error deleting absence:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
