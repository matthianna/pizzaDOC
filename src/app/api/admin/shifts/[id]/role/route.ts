import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { role } = body as { role: Role }

    if (!role) {
      return NextResponse.json({ error: 'Il ruolo è obbligatorio' }, { status: 400 })
    }

    // Verifica che il turno esista
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true,
            secondaryRole: true
          }
        }
      }
    })

    if (!shift) {
      return NextResponse.json({ error: 'Turno non trovato' }, { status: 404 })
    }

    // Aggiorna il ruolo del turno
    const updatedShift = await prisma.shift.update({
      where: { id },
      data: { role }
    })

    return NextResponse.json({
      message: 'Ruolo aggiornato con successo',
      shift: updatedShift
    })
  } catch (error) {
    console.error('Error updating shift role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

