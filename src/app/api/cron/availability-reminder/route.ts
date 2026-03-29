import { NextRequest, NextResponse } from 'next/server'
import { addDays, startOfWeek } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { addWeekCalendarDays } from '@/lib/date-utils'
import { createNotification } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'
import { isPriorityUser } from '@/lib/utils'

// Normalizza una data a mezzanotte UTC
function normalizeDate(dateInput: string | Date): Date {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
}

/**
 * Cron Job: Promemoria Disponibilità
 * Scheduled: Domenica alle 12:00
 * Trova utenti che non hanno inserito le disponibilità per la settimana prossima
 */
export async function GET(request: NextRequest) {
  try {
    // Verifica autenticazione
    const authHeader = request.headers.get('authorization')
    const vercelCronHeader = request.headers.get('x-vercel-cron')
    const cronSecret = process.env.CRON_SECRET

    const isVercelCron = vercelCronHeader !== null
    const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isVercelCron && cronSecret && !hasValidSecret) {
      return NextResponse.json({
        error: 'Unauthorized',
        hint: 'Use Authorization: Bearer <CRON_SECRET> header or wait for Vercel to run the cron automatically'
      }, { status: 401 })
    }

    console.log('🕐 Starting availability reminder cron job...', {
      triggeredBy: isVercelCron ? 'Vercel Cron' : 'Manual call'
    })

    // Calcola la settimana prossima (lunedì prossimo)
    const today = new Date()
    const nextMonday = startOfWeek(addDays(today, 7), { weekStartsOn: 1 })
    const weekStart = normalizeDate(nextMonday)
    const weekEnd = normalizeDate(addWeekCalendarDays(weekStart, 6))

    console.log(`📅 Checking availability for week: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`)

    // Trova tutti gli utenti attivi con disponibilità e assenze
    const allActiveUsers = await prisma.user.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        username: true,
        primaryRole: true,
        pushNotificationsEnabled: true,
        availabilities: {
          where: { weekStart },
          select: { id: true, isAvailable: true }
        },
        absences: {
          where: {
            OR: [
              {
                AND: [
                  { startDate: { lte: weekStart } },
                  { endDate: { gte: weekEnd } }
                ]
              },
              {
                AND: [
                  { startDate: { gte: weekStart } },
                  { endDate: { lte: weekEnd } }
                ]
              },
              {
                AND: [
                  { startDate: { lte: weekStart } },
                  { endDate: { gte: weekStart, lte: weekEnd } }
                ]
              },
              {
                AND: [
                  { startDate: { gte: weekStart, lte: weekEnd } },
                  { endDate: { gte: weekEnd } }
                ]
              }
            ]
          },
          select: { id: true, startDate: true, endDate: true }
        }
      }
    })

    // Escludi ADMIN dai promemoria (eccetto i VIP)
    const activeUsers = allActiveUsers.filter(u => 
      u.primaryRole !== 'ADMIN' || isPriorityUser(u.username)
    )

    // Filtra utenti senza disponibilità per la settimana prossima
    const usersWithoutAvailability = activeUsers.filter(user => {
      const hasNoAvailability = !user.availabilities.some(a => a.isAvailable === true)
      const isNotAdmin = user.username.toLowerCase() !== 'admin'

      // Calcola quanti giorni della settimana sono coperti da assenze
      const weekStartTime = weekStart.getTime()
      const weekEndTime = weekEnd.getTime()
      const oneDayMs = 24 * 60 * 60 * 1000

      const weekDays = new Set<string>()
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStartTime + i * oneDayMs)
        weekDays.add(dayDate.toISOString().split('T')[0])
      }

      const coveredDays = new Set<string>()
      for (const absence of user.absences) {
        const absenceStart = Math.max(absence.startDate.getTime(), weekStartTime)
        const absenceEnd = Math.min(absence.endDate.getTime(), weekEndTime)

        let currentDay = absenceStart
        while (currentDay <= absenceEnd) {
          const dayStr = new Date(currentDay).toISOString().split('T')[0]
          coveredDays.add(dayStr)
          currentDay += oneDayMs
        }
      }

      const allDaysCovered = weekDays.size === coveredDays.size &&
        Array.from(weekDays).every(day => coveredDays.has(day))

      if (hasNoAvailability && isNotAdmin && allDaysCovered) {
        console.log(`⏭️ Skipping ${user.username}: has ${coveredDays.size}/7 days covered by absences (full week off)`)
      }

      return hasNoAvailability && isNotAdmin && !allDaysCovered
    })

    console.log(`📊 Found ${usersWithoutAvailability.length} users without availability`)

    const results = {
      total: activeUsers.length,
      withoutAvailability: usersWithoutAvailability.length,
      notificationsSent: 0,
      notificationsFailed: 0
    }

    // 🔔 Send Push Notifications
    if (usersWithoutAvailability.length > 0) {
      console.log('🔔 Sending push notifications to', usersWithoutAvailability.length, 'users')

      const pushResults = await Promise.allSettled(
        usersWithoutAvailability.map(async (user) => {
          try {
            await createNotification({
              userId: user.id,
              type: NotificationType.AVAILABILITY_REMINDER,
              title: 'Promemoria Disponibilità',
              body: 'Ricordati di inserire le tue disponibilità per la prossima settimana entro domenica sera!',
              data: {
                url: '/availability'
              },
              sendPush: user.pushNotificationsEnabled
            })
            results.notificationsSent++
            return { success: true, userId: user.id }
          } catch (error) {
            console.error(`❌ Failed to send notification to ${user.username}:`, error)
            results.notificationsFailed++
            return { success: false, userId: user.id, error }
          }
        })
      )

      const successfulPush = pushResults.filter(r => r.status === 'fulfilled' && (r.value as any).success).length
      console.log(`✅ Push notifications sent: ${successfulPush}/${usersWithoutAvailability.length}`)
    }

    console.log('✅ Availability reminder cron job completed:', results)

    return NextResponse.json({
      success: true,
      message: 'Availability reminder cron job completed',
      results
    })
  } catch (error) {
    console.error('❌ Error in availability reminder cron:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
