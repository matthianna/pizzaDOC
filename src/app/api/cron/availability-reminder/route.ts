import { NextRequest, NextResponse } from 'next/server'
import { addDays, startOfWeek } from 'date-fns'
import { whatsappService } from '@/lib/whatsapp-service'
import { prisma } from '@/lib/prisma'

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

    console.log(`📅 Checking availability for week: ${weekStart.toISOString()}`)

    // Trova tutti gli utenti attivi
    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        phoneNumber: true,
        availabilities: {
          where: { weekStart },
          select: { id: true }
        }
      }
    })

    // Filtra utenti senza disponibilità per la settimana prossima
    const usersWithoutAvailability = activeUsers.filter(
      user => user.availabilities.length === 0
    )

    console.log(`📊 Found ${usersWithoutAvailability.length} users without availability`)

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

📅 È domenica! Ricordatevi di inserire le vostre disponibilità per la prossima settimana.

👥 *Utenti che non hanno ancora inserito le disponibilità:*
${usersWithoutAvailability.map(u => `• ${u.username}`).join('\n')}

🔗 Inserisci le tue disponibilità: ${process.env.NEXTAUTH_URL}/availability

⚠️ *Scadenza:* Domenica 23:59

---
🍕 PizzaDoc - Sistema Gestione Turni
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
        if (user.phoneNumber) {
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

