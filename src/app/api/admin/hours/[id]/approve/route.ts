import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-logger'

// POST /api/admin/hours/[id]/approve - Approve worked hours
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workedHours = await prisma.worked_hours.findUnique({
      where: { id: id }
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

    const updatedHours = await prisma.worked_hours.update({
      where: { id: id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        user: { select: { username: true } }
      }
    })

    // Log audit
    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'HOURS_APPROVE',
      description: `Approvate ore di ${updatedHours.user.username}: ${updatedHours.totalHours}h`,
      metadata: {
        workedHoursId: updatedHours.id,
        userId: updatedHours.userId,
        totalHours: updatedHours.totalHours
      }
    })

    return NextResponse.json(updatedHours)
  } catch (error) {
    console.error('Error approving hours:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
