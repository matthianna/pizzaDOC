import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-logger'
import { createNotification } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { clearAvailabilityForAbsenceRange } from '@/lib/absence-availability'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { id } = await params

    const absence = await prisma.absences.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })

    if (!absence) {
      return NextResponse.json({ error: 'Assenza non trovata' }, { status: 404 })
    }

    const updated = await prisma.absences.update({
      where: { id },
      data: {
        approved: true,
        approvedBy: session.user.id,
        updatedAt: new Date(),
      },
    })

    await clearAvailabilityForAbsenceRange(
      absence.userId,
      absence.startDate,
      absence.endDate
    )

    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'ABSENCE_APPROVE',
      description: `Approvata assenza di ${absence.user.username}: ${format(new Date(absence.startDate), 'dd/MM/yyyy', { locale: it })} – ${format(new Date(absence.endDate), 'dd/MM/yyyy', { locale: it })}`,
      metadata: {
        absenceId: id,
        targetUserId: absence.userId,
        targetUsername: absence.user.username,
        startDate: absence.startDate,
        endDate: absence.endDate,
        before: { approved: absence.approved },
        after: { approved: true, approvedBy: session.user.id },
      },
    })

    try {
      const formattedStartDate = format(new Date(absence.startDate), 'dd/MM/yyyy', {
        locale: it,
      })
      const formattedEndDate = format(new Date(absence.endDate), 'dd/MM/yyyy', {
        locale: it,
      })
      const dateRange =
        formattedStartDate === formattedEndDate
          ? formattedStartDate
          : `${formattedStartDate} - ${formattedEndDate}`

      await createNotification({
        userId: absence.userId,
        type: NotificationType.ABSENCE_APPROVED,
        title: 'Assenza Approvata',
        body: `La tua richiesta di assenza per ${dateRange} è stata approvata.`,
        data: {
          url: '/absences',
          relatedId: id,
        },
      })
    } catch (notificationError) {
      console.error('Error sending push notification:', notificationError)
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error approving absence:', error)
    return NextResponse.json(
      { error: "Impossibile approvare l'assenza" },
      { status: 500 }
    )
  }
}
