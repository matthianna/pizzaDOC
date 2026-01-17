import { NextRequest, NextResponse } from 'next/server'
import { addDays, startOfWeek } from 'date-fns'
import { whatsappService } from '@/lib/whatsapp-service'
import { prisma } from '@/lib/prisma'

import { createNotification } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'

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
    // Verifica autenticazione:
    // 1. Vercel Cron invia automaticamente un header speciale
    // 2. Oppure si può usare un CRON_SECRET per chiamate manuali
    const authHeader = request.headers.get('authorization')
    const vercelCronHeader = request.headers.get('x-vercel-cron') // Header speciale di Vercel
    const cronSecret = process.env.CRON_SECRET

    // Accetta se:
    // - È una chiamata da Vercel Cron (header x-vercel-cron presente)
    // - Oppure ha il CRON_SECRET corretto
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

    // Calcola l'ultimo giorno della settimana prossima (domenica)
    const weekEnd = normalizeDate(addDays(weekStart, 6))

    console.log(`📅 Checking availability for week: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`)

    // Trova tutti gli utenti attivi con disponibilità e assenze
    const activeUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        primaryRole: { not: 'ADMIN' } // ⭐ Escludi ADMIN dai promemoria
      },
      select: {
        id: true,
        username: true,
        phoneNumber: true,
        whatsappNotificationsEnabled: true,
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

    // Filtra utenti senza disponibilità per la settimana prossima
    // Escludi l'utente "admin" dalla lista
    // Escludi utenti che hanno assenze per TUTTI i 7 giorni della settimana
    const usersWithoutAvailability = activeUsers.filter(user => {
      // Controlla se ha VERA disponibilità (isAvailable: true)
      const hasNoAvailability = !user.availabilities.some(a => a.isAvailable === true)
      const isNotAdmin = user.username.toLowerCase() !== 'admin'

      // Calcola quanti giorni della settimana sono coperti da assenze
      const weekStartTime = weekStart.getTime()
      const weekEndTime = weekEnd.getTime()
      const oneDayMs = 24 * 60 * 60 * 1000

      // Crea set di tutti i giorni della settimana (7 giorni)
      const weekDays = new Set<string>()
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStartTime + i * oneDayMs)
        weekDays.add(dayDate.toISOString().split('T')[0])
      }

      // Conta giorni coperti da assenze
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

      // Se tutti i 7 giorni sono coperti da assenze, escludi l'utente
      const allDaysCovered = weekDays.size === coveredDays.size &&
        Array.from(weekDays).every(day => coveredDays.has(day))

      // Log per debug
      if (hasNoAvailability && isNotAdmin && allDaysCovered) {
        console.log(`⏭️ Skipping ${user.username}: has ${coveredDays.size}/7 days covered by absences (full week off)`)
      }

      return hasNoAvailability && isNotAdmin && !allDaysCovered
    })

    console.log(`📊 Found ${usersWithoutAvailability.length} users without availability (after filtering full-week absences)`)

    // Recupera impostazioni WhatsApp
    const [groupChatIdSetting, notificationsEnabledSetting] = await Promise.all([
      prisma.systemSettings.findUnique({ where: { key: 'whatsapp_group_chat_id' } }),
      prisma.systemSettings.findUnique({ where: { key: 'whatsapp_notifications_enabled' } })
    ])

    const groupChatId = groupChatIdSetting?.value
    const notificationsEnabled = notificationsEnabledSetting?.value === 'true'

    const results = {
      total: activeUsers.length,
      withoutAvailability: usersWithoutAvailability.length,
      notificationsSent: 0,
      notificationsFailed: 0
    }

    // Invia notifiche WhatsApp
    if (notificationsEnabled && groupChatId && usersWithoutAvailability.length > 0) {
      // Lista nomi per messaggio gruppo
      const usernames = usersWithoutAvailability.map(u => u.username).join(', ')

      // Messaggio al gruppo
      const groupMessage = `
⏰ *PROMEMORIA DISPONIBILITÀ*

📅 Ricordatevi di inserire le vostre disponibilità per la prossima settimana.

👥 *Utenti che non hanno ancora inserito le disponibilità:*
${usersWithoutAvailability.map(u => `• ${u.username}`).join('\n')}

🔗 Inserisci le tue disponibilità: https://pizzadoc.vercel.app/availability

      `.trim()

      try {
        const groupResult = await whatsappService.sendMessage({
          phoneNumber: groupChatId,
          message: groupMessage
        })

        if (groupResult.success) {
          console.log('✅ Group reminder sent successfully')
          results.notificationsSent++
        } else {
          console.error('❌ Failed to send group reminder:', groupResult.error)
          results.notificationsFailed++
        }
      } catch (error) {
        console.error('📱 Error sending group reminder:', error)
        results.notificationsFailed++
      }

      // Messaggi individuali (opzionale)
      for (const user of usersWithoutAvailability) {
        if (user.phoneNumber && user.whatsappNotificationsEnabled) {
          const personalMessage = `
⏰ *PROMEMORIA PERSONALE*

Ciao ${user.username}!

📅 Non hai ancora inserito le tue disponibilità per la prossima settimana.

🔗 Inseriscile qui: ${process.env.NEXTAUTH_URL}/availability

⚠️ *Scadenza:* Domenica 23:59

---
🍕 PizzaDoc
          `.trim()

          try {
            const personalResult = await whatsappService.sendMessage({
              phoneNumber: user.phoneNumber,
              message: personalMessage
            })

            if (personalResult.success) {
              console.log(`✅ Personal reminder sent to ${user.username}`)
              results.notificationsSent++
            } else {
              console.error(`❌ Failed to send reminder to ${user.username}:`, personalResult.error)
              results.notificationsFailed++
            }

            // Delay per evitare rate limiting (500ms tra messaggi)
            await new Promise(resolve => setTimeout(resolve, 500))
          } catch (error) {
            console.error(`📱 Error sending reminder to ${user.username}:`, error)
            results.notificationsFailed++
          }
        }
      }
    } else {
      console.log('📱 WhatsApp notifications disabled or no users without availability')
    }

    // 🔔 Send Push Notifications
    if (usersWithoutAvailability.length > 0) {
      console.log('🔔 Sending push notifications to', usersWithoutAvailability.length, 'users')

      const pushResults = await Promise.allSettled(
        usersWithoutAvailability.map(async (user) => {
          try {
            // createNotification will check if user.pushNotificationsEnabled is true
            // before calling sendPushNotification
            await createNotification({
              userId: user.id,
              type: NotificationType.AVAILABILITY_REMINDER,
              title: 'Promemoria Disponibilità',
              body: 'Ricordati di inserire le tue disponibilità per la prossima settimana entro domenica sera!',
              data: {
                url: '/availability'
              },
              sendPush: user.pushNotificationsEnabled // Explicitly pass user preference
            })
            return { success: true, userId: user.id }
          } catch (error) {
            console.error(`❌ Failed to send notification to ${user.username}:`, error)
            return { success: false, userId: user.id, error }
          }
        })
      )

      const successfulPush = pushResults.filter(r => r.status === 'fulfilled' && r.value.success).length
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

