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

    // Get the substitution request
    const substitution = await prisma.substitutions.findUnique({
      where: { id: substitutionId },
      include: {
        shift: {
          include: {
            schedule: true
          }
        }
      }
    })

    if (!substitution) {
      return NextResponse.json(
        { error: 'Substitution request not found' },
        { status: 404 }
      )
    }

    // Check if substitution can be approved (must have a substitute and be in APPLIED status)
    if (substitution.status !== 'APPLIED' || !substitution.substituteId) {
      return NextResponse.json(
        { error: 'Substitution request cannot be approved in current state' },
        { status: 400 }
      )
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update the shift to assign it to the substitute
      await tx.shift.update({
        where: { id: substitution.shiftId },
        data: {
          userId: substitution.substituteId!
        }
      })

      // 2. Update the substitution status
      const updatedSubstitution = await tx.substitution.update({
        where: { id: substitutionId },
        data: {
          status: 'APPROVED',
          approverId: session.user.id
        },
        include: {
          shift: {
            include: {
              schedule: {
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

      // 3. Cancel any existing worked hours for the original user for this shift
      await tx.workedHours.deleteMany({
        where: {
          shiftId: substitution.shiftId,
          userId: substitution.requesterId
        }
      })

      return updatedSubstitution
    })

    return NextResponse.json({
      success: true,
      substitution: result
    })
  } catch (error) {
    console.error('Error approving substitution:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
