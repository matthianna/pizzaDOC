import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addWeekCalendarDays, getNextWeekStart } from '@/lib/date-utils'
import { normalizeDate } from '@/lib/normalize-date'
import { createNotification } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'
import { isPriorityUser } from '@/lib/utils'

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

    const weekStart = normalizeDate(getNextWeekStart())
    const dayMs = 24 * 60 * 60 * 1000
    const weekStartCandidates = [
      normalizeDate(new Date(weekStart.getTime() - dayMs)),
      weekStart,
      normalizeDate(new Date(weekStart.getTime() + dayMs)),
    ]
    const weekEndDay = addWeekCalendarDays(weekStart, 6)
    const weekEnd = new Date(
      Date.UTC(
        weekEndDay.getUTCFullYear(),
        weekEndDay.getUTCMonth(),
        weekEndDay.getUTCDate(),
        23,
        59,
        59,
        999
      )
    )

    console.log(`📅 Checking availability for week: ${weekStart.toISOString()} → ${weekEnd.toISOString()}`)

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
          where: { weekStart: { in: weekStartCandidates } },
          select: { id: true, isAvailable: true }
        },
        absences: {
          where: {
            AND: [{ startDate: { lte: weekEnd } }, { endDate: { gte: weekStart } }],
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
    const utcDayKey = (d: Date) => d.toISOString().slice(0, 10)

    const usersWithoutAvailability = activeUsers.filter((user) => {
      // Ha compilato il modulo (anche tutti "no") = non sollecitare
      const hasSubmittedAvailability = user.availabilities.length > 0
      const isNotAdmin = user.username.toLowerCase() !== 'admin'

      const weekDayKeys: string[] = []
      for (let i = 0; i < 7; i++) {
        weekDayKeys.push(utcDayKey(addWeekCalendarDays(weekStart, i)))
      }

      const coveredDays = new Set<string>()
      for (const absence of user.absences) {
        const absStart = utcDayKey(absence.startDate)
        const absEnd = utcDayKey(absence.endDate)
        for (const k of weekDayKeys) {
          if (k >= absStart && k <= absEnd) coveredDays.add(k)
        }
      }

      const allDaysCovered = coveredDays.size === 7

      if (!hasSubmittedAvailability && isNotAdmin && allDaysCovered) {
        console.log(`⏭️ Skipping ${user.username}: assenza su tutta la settimana`)
      }

      return !hasSubmittedAvailability && isNotAdmin && !allDaysCovered
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
