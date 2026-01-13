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

    // Update absence
    const updated = await prisma.absences.update({
      where: { id },
      data: {
        approved: true,
        approvedBy: session.user.id,
        updatedAt: new Date()
      }
    })

    // Log audit action
    await logAuditAction({
      userId: session.user.id,
      action: 'ABSENCE_APPROVE',
      tableName: 'absences',
      recordId: id,
      changes: {
        approved: true,
        approvedBy: session.user.id
      }
    })

    // 🔔 Notify user
    try {
      const formattedStartDate = format(new Date(absence.startDate), 'dd/MM/yyyy', { locale: it })
      const formattedEndDate = format(new Date(absence.endDate), 'dd/MM/yyyy', { locale: it })
      const dateRange = formattedStartDate === formattedEndDate ? formattedStartDate : `${formattedStartDate} - ${formattedEndDate}`

      await createNotification({
        userId: absence.userId,
        type: NotificationType.ABSENCE_APPROVED,
        title: 'Assenza Approvata',
        body: `La tua richiesta di assenza per ${dateRange} è stata approvata.`,
        data: {
          url: '/absences',
          relatedId: id
        }
      })

      console.log('✅ Push notification sent for absence approval')
    } catch (notificationError) {
      console.error('❌ Error sending push notification:', notificationError)
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error approving absence:', error)
    return NextResponse.json(
      { error: 'Failed to approve absence' },
      { status: 500 }
    )
  }
}
