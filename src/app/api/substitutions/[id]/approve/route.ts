import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/substitutions/[id]/approve - Approve substitution
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { responseNote } = await request.json()

    const substitution = await prisma.substitutions.findUnique({
      where: { id: id },
      include: {
        shifts: {
          include: {
            user: true
          }
        }
      }
    })

    if (!substitution) {
      return NextResponse.json(
        { error: 'Substitution not found' },
        { status: 404 }
      )
    }

    // Only the original shift owner or admin can approve
    const isOwner = substitution.shifts.userId === session.user.id
    const isAdmin = session.user.roles.includes('ADMIN')

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to approve this substitution' },
        { status: 403 }
      )
    }

    // Check if substitution is already processed
    if (substitution.status !== 'APPLIED' && substitution.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Substitution already processed' },
        { status: 400 }
      )
    }

    // Check if substitution has a substitute (must be in APPLIED status to approve)
    if (substitution.status !== 'APPLIED') {
      return NextResponse.json(
        { error: 'Substitution must have an applicant before approval' },
        { status: 400 }
      )
    }

    if (!substitution.substituteId) {
      return NextResponse.json(
        { error: 'Substitution must have a substitute assigned' },
        { status: 400 }
      )
    }

    if (new Date() > substitution.deadline) {
      return NextResponse.json(
        { error: 'Substitution deadline has passed' },
        { status: 400 }
      )
    }

    // Update substitution and shift
    await prisma.$transaction(async (tx) => {
      // Update substitution
      await tx.substitutions.update({
        where: { id: id },
        data: {
          status: 'APPROVED',
          approverId: session.user.id,
          responseNote: responseNote || null,
          updatedAt: new Date()
        }
      })

      // Update shift assignment to the substitute
      await tx.shifts.update({
        where: { id: substitution.shiftId },
        data: {
          userId: substitution.substituteId,
          updatedAt: new Date()
        }
      })

      // Cancel any existing worked hours for the original user for this shift
      await tx.worked_hours.deleteMany({
        where: {
          shiftId: substitution.shiftId,
          userId: substitution.requesterId
        }
      })

      // Reject other pending/applied substitutions for this shift
      await tx.substitutions.updateMany({
        where: {
          shiftId: substitution.shiftId,
          status: { in: ['PENDING', 'APPLIED'] },
          id: { not: id }
        },
        data: {
          status: 'REJECTED',
          responseNote: 'Another substitution was approved',
          updatedAt: new Date()
        }
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error approving substitution:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
