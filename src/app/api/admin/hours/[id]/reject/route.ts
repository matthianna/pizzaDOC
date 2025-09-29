import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/admin/hours/[id]/reject - Reject worked hours
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reason } = await request.json()

    if (!reason) {
      return NextResponse.json(
        { error: 'Motivo del rifiuto richiesto' },
        { status: 400 }
      )
    }

    const workedHours = await prisma.workedHours.findUnique({
      where: { id: params.id }
    })

    if (!workedHours) {
      return NextResponse.json(
        { error: 'Ore non trovate' },
        { status: 404 }
      )
    }

    if (workedHours.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Ore già processate' },
        { status: 400 }
      )
    }

    const updatedHours = await prisma.workedHours.update({
      where: { id: params.id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        reviewedAt: new Date()
      }
    })

    return NextResponse.json(updatedHours)
  } catch (error) {
    console.error('Error rejecting hours:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
