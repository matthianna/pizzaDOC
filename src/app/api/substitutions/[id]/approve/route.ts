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

    const substitution = await prisma.substitution.findUnique({
      where: { id: id },
      include: {
        shift: {
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
    const isOwner = substitution.shift.userId === session.user.id
    const isAdmin = session.user.roles.includes('ADMIN')

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to approve this substitution' },
        { status: 403 }
      )
    }

    if (substitution.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Substitution already processed' },
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
      await tx.substitution.update({
        where: { id: id },
        data: {
          status: 'APPROVED',
          approverId: session.user.id,
          responseNote: responseNote || null
        }
      })

      // Update shift assignment
      await tx.shift.update({
        where: { id: substitution.shiftId },
        data: {
          userId: substitution.requesterId,
          status: 'SUBSTITUTED'
        }
      })

      // Reject other pending substitutions for this shift
      await tx.substitution.updateMany({
        where: {
          shiftId: substitution.shiftId,
          status: 'PENDING',
          id: { not: id }
        },
        data: {
          status: 'REJECTED',
          responseNote: 'Another substitution was approved'
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
