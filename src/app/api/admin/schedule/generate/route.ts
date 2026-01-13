import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MaxCoverageAlgorithm } from '@/lib/max-coverage-algorithm'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import { logAuditAction } from '@/lib/audit-logger'
import { createNotification } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

async function saveSchedule(weekStart: Date, shifts: any[]): Promise<string> {
  // Elimina schedule esistente se presente
  const existingSchedule = await prisma.schedules.findUnique({
    where: { weekStart },
    include: { shifts: true }
  })

  if (existingSchedule) {
    await prisma.shifts.deleteMany({
      where: { scheduleId: existingSchedule.id }
    })
    await prisma.schedules.delete({
      where: { id: existingSchedule.id }
    })
  }

  // Crea nuovo schedule
  const now = new Date()
  const schedule = await prisma.schedules.create({
    data: {
      id: crypto.randomUUID(),
      weekStart,
      updatedAt: now,
      shifts: {
        create: shifts.map(shift => ({
          id: crypto.randomUUID(),
          userId: shift.userId,
          dayOfWeek: shift.dayOfWeek,
          shiftType: shift.shiftType,
          role: shift.role,
          startTime: shift.startTime,
          endTime: shift.endTime,
          updatedAt: now
        }))
      }
    }
  })

  return schedule.id
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { weekStart } = await request.json()

    if (!weekStart) {
      return NextResponse.json(
        { error: 'Week start required' },
        { status: 400 }
      )
    }

    const weekStartDate = normalizeDate(weekStart)
    const algorithm = new MaxCoverageAlgorithm()

    // Generate max coverage schedule
    const result = await algorithm.generateMaxCoverageSchedule(weekStartDate)

    // Save schedule
    const scheduleId = await saveSchedule(weekStartDate, result.shifts)

    // Log audit
    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'SCHEDULE_GENERATE',
      description: `Generato piano settimanale per ${weekStartDate.toISOString().split('T')[0]}`,
      metadata: {
        weekStart: weekStartDate.toISOString(),
        shiftsGenerated: result.shifts.length,
        totalShifts: result.statistics.totalShifts,
        quality: result.statistics.quality
      }
    })

    // 🔔 Notify users
    try {
      const uniqueUserIds = [...new Set(result.shifts.map(s => s.userId))]
      const formattedDate = format(weekStartDate, 'dd/MM/yyyy', { locale: it })

      await Promise.allSettled(uniqueUserIds.map(userId =>
        createNotification({
          userId,
          type: NotificationType.SCHEDULE_PUBLISHED,
          title: 'Nuovo Orario Pubblicato',
          body: `È stato pubblicato l'orario per la settimana del ${formattedDate}.`,
          data: {
            url: '/schedule',
            weekStart: weekStartDate.toISOString()
          }
        })
      ))

      console.log(`✅ Sent schedule notifications to ${uniqueUserIds.length} users`)
    } catch (notificationError) {
      console.error('❌ Error sending schedule notifications:', notificationError)
    }

    return NextResponse.json({
      scheduleId,
      shiftsGenerated: result.shifts.length,
      gaps: result.statistics.gaps,
      statistics: {
        totalShifts: result.statistics.totalShifts,
        rolesAssigned: result.statistics.rolesAssigned,
        quality: result.statistics.quality
      }
    })
  } catch (error) {
    console.error('Error generating schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
