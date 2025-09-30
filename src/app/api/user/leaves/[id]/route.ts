import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LeaveType } from '@prisma/client'

// PUT /api/user/leaves/[id] - Update leave request
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
    const { id } = resolvedParams
    const { startDate, endDate, type, reason } = await request.json()

    // Verifica che l'assenza esista e appartenga all'utente
    const existingLeave = await prisma.leave.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!existingLeave) {
      return NextResponse.json(
        { error: 'Assenza non trovata' },
        { status: 404 }
      )
    }

    // Non permettere modifiche a vacanze nel passato
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (existingLeave.startDate < today) {
      return NextResponse.json(
        { error: 'Non puoi modificare vacanze nel passato' },
        { status: 400 }
      )
    }

    // Se è stata rifiutata, non permettere modifiche
    if (existingLeave.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Non puoi modificare una richiesta rifiutata' },
        { status: 400 }
      )
    }

    // Validazioni sui nuovi dati
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start < today) {
      return NextResponse.json(
        { error: 'Non puoi impostare date nel passato' },
        { status: 400 }
      )
    }

    if (end < start) {
      return NextResponse.json(
        { error: 'La data di fine deve essere posteriore alla data di inizio' },
        { status: 400 }
      )
    }

    if (!Object.values(LeaveType).includes(type)) {
      return NextResponse.json(
        { error: 'Tipo di assenza non valido' },
        { status: 400 }
      )
    }

    // Verifica sovrapposizioni con altre vacanze (escludendo questa)
    const overlappingLeaves = await prisma.leave.findMany({
      where: {
        userId: session.user.id,
        id: {
          not: id
        },
        status: {
          in: ['PENDING', 'APPROVED']
        },
        OR: [
          {
            startDate: {
              lte: end
            },
            endDate: {
              gte: start
            }
          }
        ]
      }
    })

    if (overlappingLeaves.length > 0) {
      return NextResponse.json(
        { error: 'Hai già una richiesta di assenza in queste date' },
        { status: 400 }
      )
    }

    const updatedLeave = await prisma.leave.update({
      where: { id },
      data: {
        startDate: start,
        endDate: end,
        type,
        reason: reason || null,
        status: 'PENDING' // Reset status to pending quando modificata
      }
    })

    return NextResponse.json(updatedLeave)
  } catch (error) {
    console.error('Error updating leave:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/user/leaves/[id] - Delete leave request
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
    const { id } = resolvedParams

    // Verifica che l'assenza esista e appartenga all'utente
    const existingLeave = await prisma.leave.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!existingLeave) {
      return NextResponse.json(
        { error: 'Assenza non trovata' },
        { status: 404 }
      )
    }

    // Non permettere cancellazione di vacanze nel passato
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (existingLeave.startDate < today) {
      return NextResponse.json(
        { error: 'Non puoi eliminare vacanze nel passato' },
        { status: 400 }
      )
    }

    await prisma.leave.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting leave:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
