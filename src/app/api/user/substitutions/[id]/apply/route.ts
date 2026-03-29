import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { normalizeDate } from '@/lib/normalize-date'
import { addWeekCalendarDays } from '@/lib/date-utils'
import { createNotification } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'

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

    // Check if shift has already started
    const weekStart = normalizeDate(substitution.shifts.schedules.weekStart)
    // dayOfWeek è già nel formato corretto: 0=Lunedì, 1=Martedì, ..., 6=Domenica
    const shiftDate = addWeekCalendarDays(weekStart, substitution.shifts.dayOfWeek)

    // Parse shift start time (format: "HH:MM")
    const [startHour, startMinute] = substitution.shifts.startTime.split(':').map(Number)
    const shiftStartDateTime = new Date(shiftDate)
    shiftStartDateTime.setHours(startHour, startMinute, 0, 0)

    // ✅ Permetti candidature fino all'orario di inizio del turno
    if (shiftStartDateTime <= new Date()) {
      return NextResponse.json(
        { error: 'Il turno è già iniziato. Non è più possibile candidarsi.' },
        { status: 400 }
      )
    }

    // Check if deadline has passed (dovrebbe coincidere con l'orario di inizio)
    if (new Date() >= new Date(substitution.deadline)) {
      return NextResponse.json(
        { error: 'Il periodo per candidarsi è scaduto.' },
        { status: 400 }
      )
    }

    // Check if user can perform the required role
    const user_roles = await prisma.user_roles.findMany({
      where: { userId: session.user.id },
      select: { role: true }
    })

    const canPerformRole = user_roles.some(ur => ur.role === substitution.shifts.role)

    if (!canPerformRole) {
      return NextResponse.json(
        { error: `Non puoi candidarti per questo turno. Ruolo richiesto: ${substitution.shifts.role}` },
        { status: 400 }
      )
    }

    // Check if user is already working another shift at the same time
    const conflictingShift = await prisma.shifts.findFirst({
      where: {
        userId: session.user.id,
        schedules: {
          weekStart: substitution.shifts.schedules.weekStart
        },
        dayOfWeek: substitution.shifts.dayOfWeek,
        shiftType: substitution.shifts.shiftType
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
            username: true,
            phoneNumber: true
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

    // 🔔 Invia notifica Push al richiedente
    try {
      await createNotification({
        userId: substitution.requesterId,
        type: NotificationType.SUBSTITUTION_APPLIED,
        title: 'Candidatura Ricevuta',
        body: `${session.user.name || session.user.username} si è candidato per il tuo turno di ${substitution.shifts.shiftType} del ${format(shiftDate, 'dd/MM')}.`,
        data: {
          url: '/substitution-requests',
          relatedId: substitutionId
        }
      })

      console.log('✅ Push notification sent to requester')
    } catch (notificationError) {
      console.error('❌ Error sending push notification:', notificationError)
    }

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
