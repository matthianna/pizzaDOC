import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
// PUT /api/user/absences/[id] - Update absence
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

    // Check if absence exists and belongs to user
    const existingAbsence = await prisma.absence.findFirst({
      where: {
        id: absenceId,
        userId: session.user.id
      }
    })

    if (!existingAbsence) {
      return NextResponse.json(
        { error: 'Absence not found' },
        { status: 404 }
      )
    }

    // Cannot modify past absences
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (existingAbsence.startDate < today) {
      return NextResponse.json(
        { error: 'Cannot modify past absences' },
        { status: 400 }
      )
    }

    const { startDate, endDate, type, reason, description } = await request.json()

    // Validation
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    // Cannot set dates in the past
    if (start < today) {
      return NextResponse.json(
        { error: 'Cannot set dates in the past' },
        { status: 400 }
      )
    }

    // End date must be after start date
    if (end < start) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // Check for overlapping absences (excluding current one)
    const overlappingAbsences = await prisma.absence.findMany({
      where: {
        userId: session.user.id,
        id: { not: absenceId },
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start }
          }
        ]
      }
    })

    if (overlappingAbsences.length > 0) {
      return NextResponse.json(
        { error: 'There is already an absence in this period' },
        { status: 400 }
      )
    }

    const updatedAbsence = await prisma.absence.update({
      where: { id: absenceId },
      data: {
        startDate: start,
        endDate: end,
        type: type || existingAbsence.type,
        reason: reason || null,
        description: description || null
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
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const absenceId = resolvedParams.id

    // Check if absence exists and belongs to user
    const existingAbsence = await prisma.absence.findFirst({
      where: {
        id: absenceId,
        userId: session.user.id
      }
    })

    if (!existingAbsence) {
      return NextResponse.json(
        { error: 'Absence not found' },
        { status: 404 }
      )
    }

    // Cannot delete past absences
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
