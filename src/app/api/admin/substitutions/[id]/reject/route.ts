import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const substitutionId = resolvedParams.id
    const { responseNote } = await request.json()

    // Get the substitution request
    const substitution = await prisma.substitutions.findUnique({
      where: { id: substitutionId }
    })

    if (!substitution) {
      return NextResponse.json(
        { error: 'Substitution request not found' },
        { status: 404 }
      )
    }

    // Check if substitution can be rejected
    if (!['PENDING', 'APPLIED'].includes(substitution.status)) {
      return NextResponse.json(
        { error: 'Substitution request cannot be rejected in current state' },
        { status: 400 }
      )
    }

    // Update substitution status to rejected
    const updatedSubstitution = await prisma.substitutions.update({
      where: { id: substitutionId },
      data: {
        status: 'REJECTED',
        approverId: session.user.id,
        responseNote: responseNote || null,
        substituteId: null, // Remove substitute assignment
        updatedAt: new Date()
      },
      include: {
        shifts: {
          include: {
            schedules: {
              select: {
                weekStart: true
              }
            }
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

    return NextResponse.json({
      success: true,
      substitution: updatedSubstitution
    })
  } catch (error) {
    console.error('Error rejecting substitution:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
