import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-logger'
import { createNotification } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { reason } = body

    if (!reason || reason.trim() === '') {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    // Find the absence
    const absence = await prisma.absences.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    })

    if (!absence) {
      return NextResponse.json({ error: 'Absence not found' }, { status: 404 })
    }

    // Delete the absence (rejection = deletion with reason logged)
    await prisma.absences.delete({
      where: { id }
    })

    // Log audit action with rejection reason
    await logAuditAction({
      userId: session.user.id,
      action: 'ABSENCE_REJECT',
      tableName: 'absences',
      recordId: id,
      changes: {
        userId: absence.userId,
        username: absence.user.username,
        startDate: absence.startDate,
        endDate: absence.endDate,
        rejectionReason: reason
      }
    })

    // 🔔 Notify user
    try {
      const formattedStartDate = format(new Date(absence.startDate), 'dd/MM/yyyy', { locale: it })
      const formattedEndDate = format(new Date(absence.endDate), 'dd/MM/yyyy', { locale: it })
      const dateRange = formattedStartDate === formattedEndDate ? formattedStartDate : `${formattedStartDate} - ${formattedEndDate}`

      await createNotification({
        userId: absence.userId,
        type: NotificationType.ABSENCE_REJECTED,
        title: 'Assenza Rifiutata',
        body: `La tua richiesta di assenza per ${dateRange} è stata rifiutata. Motivo: ${reason}`,
        data: {
          url: '/absences'
        }
      })

      console.log('✅ Push notification sent for absence rejection')
    } catch (notificationError) {
      console.error('❌ Error sending push notification:', notificationError)
    }

    return NextResponse.json({ success: true, message: 'Absence rejected and deleted' })
  } catch (error) {
    console.error('Error rejecting absence:', error)
    return NextResponse.json(
      { error: 'Failed to reject absence' },
      { status: 500 }
    )
  }
}
