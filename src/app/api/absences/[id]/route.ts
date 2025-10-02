import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT /api/absences/[id] - Update absence
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { startDate, endDate, type, reason } = await request.json()

    // Check ownership
    const existing = await prisma.absence.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    if (start < now) {
      return NextResponse.json({ error: 'Cannot modify past absence' }, { status: 400 })
    }

    if (end < start) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }

    const updated = await prisma.absence.update({
      where: { id },
      data: { startDate: start, endDate: end, type, reason }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating absence:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/absences/[id] - Delete absence
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check ownership
    const existing = await prisma.absence.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Can't delete if already started
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    
    if (new Date(existing.startDate) < now) {
      return NextResponse.json({ error: 'Cannot delete past or ongoing absence' }, { status: 400 })
    }

    await prisma.absence.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting absence:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

