import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addDays } from 'date-fns'
import { normalizeDate } from '@/lib/normalize-date'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.id) {
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
        },
        requester: {
          select: {
            id: true,
            username: true
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

    // Check if user is trying to apply to their own request
    if (substitution.requesterId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot apply to your own substitution request' },
        { status: 400 }
      )
    }

    // Check if substitution is still available
    if (substitution.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Substitution request is no longer available' },
        { status: 400 }
      )
    }

    // Check if deadline has passed
    if (new Date() >= new Date(substitution.deadline)) {
      return NextResponse.json(
        { error: 'Substitution request deadline has passed' },
        { status: 400 }
      )
    }

    // Check if shift is in the future
    const weekStart = normalizeDate(substitution.shift.schedules.weekStart)
    // dayOfWeek è già nel formato corretto: 0=Lunedì, 1=Martedì, ..., 6=Domenica
    const shiftDate = addDays(weekStart, substitution.shift.dayOfWeek)
    
    if (shiftDate <= new Date()) {
      return NextResponse.json(
        { error: 'Cannot apply for past shifts' },
        { status: 400 }
      )
    }

    // Check if user can perform the required role
    const user_roles = await prisma.userRole.findMany({
      where: { userId: session.user.id },
      select: { role: true }
    })

    const canPerformRole = user_roles.some(ur => ur.role === substitution.shift.role)
    
    if (!canPerformRole) {
      return NextResponse.json(
        { error: `Non puoi candidarti per questo turno. Ruolo richiesto: ${substitution.shift.role}` },
        { status: 400 }
      )
    }

    // Check if user is already working another shift at the same time
    const conflictingShift = await prisma.shifts.findFirst({
      where: {
        userId: session.user.id,
        schedule: {
          weekStart: substitution.shift.schedules.weekStart
        },
        dayOfWeek: substitution.shift.dayOfWeek,
        shiftType: substitution.shift.shiftType
      }
    })

    if (conflictingShift) {
      return NextResponse.json(
        { error: 'Hai già un turno assegnato in questo orario' },
        { status: 400 }
      )
    }

    // Update substitution request with applicant
    const updatedSubstitution = await prisma.substitutions.update({
      where: { id: substitutionId },
      data: {
        substituteId: session.user.id,
        status: 'APPLIED'
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

    return NextResponse.json({
      success: true,
      substitution: updatedSubstitution
    })
  } catch (error) {
    console.error('Error applying for substitution:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
