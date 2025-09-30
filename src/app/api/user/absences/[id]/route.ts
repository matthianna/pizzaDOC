import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAuthenticated } from '@/lib/auth-utils'

// GET /api/user/absences/[id] - Get specific absence
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const absence = await prisma.absence.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!absence) {
      return NextResponse.json(
        { error: 'Assenza non trovata' },
        { status: 404 }
      )
    }

    return NextResponse.json(absence)
  } catch (error) {
    console.error('Error fetching absence:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/user/absences/[id] - Update absence
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { startDate, endDate, type, reason, notes } = await request.json()

    // Trova l'assenza esistente
    const existingAbsence = await prisma.absence.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!existingAbsence) {
      return NextResponse.json(
        { error: 'Assenza non trovata' },
        { status: 404 }
      )
    }

    // Non permettere modifica di assenze già iniziate
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (existingAbsence.startDate < today) {
      return NextResponse.json(
        { error: 'Non puoi modificare assenze già iniziate' },
        { status: 400 }
      )
    }

    // Validazioni sui nuovi dati
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)

      if (start < today) {
        return NextResponse.json(
          { error: 'Non puoi impostare assenze nel passato' },
          { status: 400 }
        )
      }

      if (end < start) {
        return NextResponse.json(
          { error: 'La data di fine deve essere successiva o uguale alla data di inizio' },
          { status: 400 }
        )
      }

      // Controlla sovrapposizioni (escludendo l'assenza corrente)
      const overlappingAbsence = await prisma.absence.findFirst({
        where: {
          userId: session.user.id,
          id: { not: resolvedParams.id },
          status: { in: ['PENDING', 'APPROVED'] },
          OR: [
            {
              startDate: { lte: end },
              endDate: { gte: start }
            }
          ]
        }
      })

      if (overlappingAbsence) {
        return NextResponse.json(
          { error: 'Esiste già un\'assenza in questo periodo' },
          { status: 400 }
        )
      }
    }

    const updatedAbsence = await prisma.absence.update({
      where: { id: resolvedParams.id },
      data: {
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(type && { type }),
        ...(reason !== undefined && { reason }),
        ...(notes !== undefined && { notes })
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

// DELETE /api/user/absences/[id] - Delete absence
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const absence = await prisma.absence.findFirst({
      where: {
        id: resolvedParams.id,
        userId: session.user.id
      }
    })

    if (!absence) {
      return NextResponse.json(
        { error: 'Assenza non trovata' },
        { status: 404 }
      )
    }

    // Non permettere eliminazione di assenze già iniziate
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (absence.startDate < today) {
      return NextResponse.json(
        { error: 'Non puoi eliminare assenze già iniziate' },
        { status: 400 }
      )
    }

    await prisma.absence.delete({
      where: { id: resolvedParams.id }
    })

    return NextResponse.json({ message: 'Assenza eliminata con successo' })
  } catch (error) {
    console.error('Error deleting absence:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
