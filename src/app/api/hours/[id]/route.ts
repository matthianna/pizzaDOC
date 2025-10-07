import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateHours } from '@/lib/utils'

// PUT /api/hours/[id] - Update worked hours
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { startTime, endTime } = await request.json()

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'Dati mancanti' },
        { status: 400 }
      )
    }

    // Check if hours exist and belong to user
    const existingHours = await prisma.worked_hours.findFirst({
      where: {
        id: id,
        userId: session.user.id,
        status: 'PENDING' // Can only edit pending hours
      }
    })

    if (!existingHours) {
      return NextResponse.json(
        { error: 'Ore non trovate o non modificabili' },
        { status: 404 }
      )
    }

    const totalHours = calculateHours(startTime, endTime)
    if (totalHours <= 0) {
      return NextResponse.json(
        { error: 'L\'orario di fine deve essere successivo a quello di inizio' },
        { status: 400 }
      )
    }

    const updatedHours = await prisma.worked_hours.update({
      where: { id: id },
      data: {
        startTime,
        endTime,
        totalHours,
        submittedAt: new Date() // Reset submission time
      }
    })

    return NextResponse.json(updatedHours)
  } catch (error) {
    console.error('Error updating worked hours:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/hours/[id] - Delete worked hours
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if hours exist and belong to user
    const existingHours = await prisma.worked_hours.findFirst({
      where: {
        id: id,
        userId: session.user.id,
        status: 'PENDING' // Can only delete pending hours
      }
    })

    if (!existingHours) {
      return NextResponse.json(
        { error: 'Ore non trovate o non eliminabili' },
        { status: 404 }
      )
    }

    await prisma.worked_hours.delete({
      where: { id: id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting worked hours:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
