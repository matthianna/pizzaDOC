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

    // Calcola la settimana prossima (lunedì prossimo) in UTC
    const today = new Date()
    
    // Trova il lunedì PROSSIMO usando solo UTC per evitare problemi di fuso orario
    const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
    const todayUTCDate = new Date(todayUTC)
    const dayOfWeek = todayUTCDate.getUTCDay() // 0=Domenica, 1=Lunedì, ..., 6=Sabato
    
    // Calcola giorni fino al prossimo lunedì
    const daysUntilNextMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek)
    
    // Crea weekStart (lunedì prossimo a mezzanotte UTC)
    const weekStart = new Date(todayUTC)
    weekStart.setUTCDate(weekStart.getUTCDate() + daysUntilNextMonday)
    weekStart.setUTCHours(0, 0, 0, 0)
    
    // Crea weekEnd (domenica successiva a 23:59:59.999 UTC)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
    weekEnd.setUTCHours(23, 59, 59, 999)

    console.log(`📅 Checking availability for week: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`)

    // Trova tutti gli utenti attivi con disponibilità e assenze
    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        phoneNumber: true,
        availabilities: {
          where: { 
            weekStart: {
              equals: weekStart
            }
          },
          select: { id: true, isAvailable: true }
        },
        absences: {
          where: {
            // Trova assenze che si sovrappongono con la settimana
            startDate: { lte: weekEnd },
            endDate: { gte: weekStart }
          },
          select: { id: true, startDate: true, endDate: true }
        }
      }
    })

    // Filtra utenti senza disponibilità per la settimana prossima
    // Escludi l'utente "admin" dalla lista
    // Escludi utenti che hanno assenze per TUTTI i 7 giorni della settimana
    const usersWithoutAvailability = activeUsers.filter(user => {
      // Un utente "ha disponibilità" solo se ha ALMENO UN giorno con isAvailable: true
      const hasAtLeastOneAvailability = user.availabilities.some(a => a.isAvailable === true)
      const hasNoAvailability = !hasAtLeastOneAvailability
      const isNotAdmin = user.username.toLowerCase() !== 'admin'
      
      // Calcola quanti giorni della settimana sono coperti da assenze
      let coveredDays = new Set<number>()
      for (const absence of user.absences) {
        // Per ogni assenza, calcola quali giorni della settimana copre
        const absenceStart = new Date(Math.max(absence.startDate.getTime(), weekStart.getTime()))
        const absenceEnd = new Date(Math.min(absence.endDate.getTime(), weekEnd.getTime()))
        
        // Calcola i giorni tra start e end (inclusi)
        const startDay = Math.floor((absenceStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
        const endDay = Math.floor((absenceEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
        
        for (let day = startDay; day <= endDay; day++) {
          if (day >= 0 && day <= 6) {
            coveredDays.add(day)
          }
        }
      }
      
      const hasLessThan7Absences = coveredDays.size < 7
      
      // Log per debug
      if (user.absences.length > 0) {
        console.log(`📊 ${user.username}: ${user.absences.length} absences, covering ${coveredDays.size}/7 days`)
      }
      
      if (hasNoAvailability && isNotAdmin && !hasLessThan7Absences) {
        console.log(`⏭️ Skipping ${user.username}: has absences covering all 7 days (full week off)`)
      }
      
      return hasNoAvailability && isNotAdmin && hasLessThan7Absences
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

