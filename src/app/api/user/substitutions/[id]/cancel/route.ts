import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/user/substitutions/[id]/cancel - Cancel a substitution request
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const substitutionId = params.id

    // Fetch the substitution
    const substitution = await prisma.substitutions.findUnique({
      where: { id: substitutionId },
      include: {
        shifts: {
          include: {
            schedules: true
          }
        },
        requester: {
          select: {
            id: true,
            username: true
          }
        },
        substitute: {
          select: {
            id: true,
            username: true
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

    // Verify the user is the requester
    if (substitution.requesterId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only cancel your own substitution requests' },
        { status: 403 }
      )
    }

    // Only allow cancellation if status is PENDING or APPLIED
    if (!['PENDING', 'APPLIED'].includes(substitution.status)) {
      return NextResponse.json(
        { error: `Cannot cancel substitution with status ${substitution.status}` },
        { status: 400 }
      )
    }

    // Update status to CANCELLED
    const cancelledSubstitution = await prisma.substitutions.update({
      where: { id: substitutionId },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date()
      },
      include: {
        shifts: {
          include: {
            schedules: true
          }
        },
        requester: {
          select: {
            id: true,
            username: true
          }
        }
      }
    })

    console.log(`✅ Substitution cancelled by user ${session.user.id}:`, substitutionId)

    return NextResponse.json({
      success: true,
      message: 'Substitution request cancelled successfully',
      substitution: cancelledSubstitution
    })
  } catch (error) {
    console.error('Error cancelling substitution:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




