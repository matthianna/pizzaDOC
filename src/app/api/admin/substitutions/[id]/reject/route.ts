import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { addWeekCalendarDays } from '@/lib/date-utils'
import { createNotification } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'

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



    // 🔔 Send notifications
    try {
      const shiftDate = addWeekCalendarDays(new Date(updatedSubstitution.shifts.schedules.weekStart), updatedSubstitution.shifts.dayOfWeek)
      const formattedDate = format(shiftDate, 'dd/MM', { locale: it })

      // 1. Notify Requester (Rejected)
      await createNotification({
        userId: updatedSubstitution.requesterId,
        type: NotificationType.SUBSTITUTION_REJECTED,
        title: 'Sostituzione Rifiutata',
        body: `La tua richiesta di sostituzione per il ${formattedDate} è stata rifiutata dall'amministratore.${responseNote ? ` Motivo: ${responseNote}` : ''}`,
        data: {
          url: '/substitution-requests',
          relatedId: substitutionId
        }
      })

      // 2. Notify Substitute (Rejected) - using the ID from the original fetch before it was cleared
      if (substitution.substituteId) {
        await createNotification({
          userId: substitution.substituteId,
          type: NotificationType.SUBSTITUTION_REJECTED,
          title: 'Candidatura Rifiutata',
          body: `La tua candidatura per il turno del ${formattedDate} è stata rifiutata.${responseNote ? ` Motivo: ${responseNote}` : ''}`,
          data: {
            url: '/substitution-requests',
            relatedId: substitutionId
          }
        })
      }

      console.log('✅ Push notifications sent for substitution rejection')
    } catch (notificationError) {
      console.error('❌ Error sending push notifications:', notificationError)
    }

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
