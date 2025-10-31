import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { whatsappService } from '@/lib/whatsapp-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * CRON JOB: Promemoria ore lavorate mancanti
 * Eseguito ogni giovedì alle 15:00 CEST (13:00 UTC)
 * 
 * Invia un messaggio WhatsApp al gruppo con la lista dei dipendenti
 * che non hanno ancora inserito le ore per i turni completati
 */
export async function GET(request: NextRequest) {
  try {
    // 🔒 Verifica autenticazione:
    // 1. Vercel Cron invia automaticamente un header speciale
    // 2. Oppure si può usare un CRON_SECRET per chiamate manuali
    const authHeader = request.headers.get('authorization')
    const vercelCronHeader = request.headers.get('x-vercel-cron') // Header speciale di Vercel
    const cronSecret = process.env.CRON_SECRET
    
    // Accetta se:
    // - È una chiamata da Vercel Cron (header x-vercel-cron presente)
    // - Oppure ha il CRON_SECRET corretto (se configurato)
    const isVercelCron = vercelCronHeader !== null
    const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`
    
    if (!isVercelCron && cronSecret && !hasValidSecret) {
      console.error('❌ [CRON hours-reminder] Unauthorized request')
      return NextResponse.json({ 
        error: 'Unauthorized',
        hint: 'Use Authorization: Bearer <CRON_SECRET> header or wait for Vercel to run the cron automatically'
      }, { status: 401 })
    }

    console.log('⏰ [CRON hours-reminder] Starting hours reminder job...', {
      triggeredBy: isVercelCron ? 'Vercel Cron' : 'Manual call'
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Query 1: Turni senza ORE (nessuna riga in worked_hours)
    const shiftsWithoutHours = await prisma.shifts.findMany({
      where: {
        schedules: {
          weekStart: {
            lt: today
          }
        },
        worked_hours: {
          is: null
        },
        user: {
          isActive: true,
          trackHours: true,
          whatsappNotificationsEnabled: true // ⭐ FILTRA SOLO utenti con notifiche abilitate
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        },
        schedules: {
          select: {
            weekStart: true
          }
        }
      }
    })

    // Query 2: Turni con ore RIFIUTATE
    const shiftsWithRejectedHours = await prisma.shifts.findMany({
      where: {
        schedules: {
          weekStart: {
            lt: today
          }
        },
        worked_hours: {
          is: {
            status: 'REJECTED'
          }
        },
        user: {
          isActive: true,
          trackHours: true,
          whatsappNotificationsEnabled: true // ⭐ FILTRA SOLO utenti con notifiche abilitate
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        },
        schedules: {
          select: {
            weekStart: true
          }
        }
      }
    })

    // Combina i risultati
    const allShifts = [...shiftsWithoutHours, ...shiftsWithRejectedHours]

    // Filtra solo turni passati
    const missingHours = allShifts
      .map(shift => {
        const shiftDate = new Date(shift.schedules.weekStart)
        shiftDate.setDate(shiftDate.getDate() + shift.dayOfWeek)
        
        return {
          userId: shift.user.id,
          username: shift.user.username,
          shiftDate: shiftDate
        }
      })
      .filter(shift => shift.shiftDate < today)

    // Raggruppa per utente e conta turni
    const groupedByUser = missingHours.reduce((acc, item) => {
      if (!acc[item.userId]) {
        acc[item.userId] = {
          username: item.username,
          count: 0
        }
      }
      acc[item.userId].count += 1
      return acc
    }, {} as Record<string, { username: string; count: number }>)

    const result = Object.values(groupedByUser).sort((a, b) => 
      b.count - a.count // Ordina per numero di turni mancanti (decrescente)
    )

    console.log(`📊 [CRON hours-reminder] Turni senza ore: ${shiftsWithoutHours.length}`)
    console.log(`📊 [CRON hours-reminder] Turni con ore rifiutate: ${shiftsWithRejectedHours.length}`)
    console.log(`📊 [CRON hours-reminder] Utenti con ore mancanti: ${result.length}`)

    // Se non ci sono ore mancanti, non inviare messaggio
    if (result.length === 0) {
      console.log('✅ [CRON hours-reminder] Nessuna ora mancante. Nessun messaggio da inviare.')
      return NextResponse.json({
        success: true,
        message: 'No missing hours to report',
        usersWithMissingHours: 0
      })
    }

    // 📱 Invia messaggio WhatsApp al gruppo
    try {
      const [groupChatIdSetting, notificationsEnabledSetting] = await Promise.all([
        prisma.systemSettings.findUnique({ where: { key: 'whatsapp_group_chat_id' } }),
        prisma.systemSettings.findUnique({ where: { key: 'whatsapp_notifications_enabled' } })
      ])

      const groupChatId = groupChatIdSetting?.value
      const notificationsEnabled = notificationsEnabledSetting?.value === 'true'

      if (!notificationsEnabled || !groupChatId) {
        console.log('⚠️ [CRON hours-reminder] WhatsApp notifications are disabled or group not configured')
        return NextResponse.json({
          success: true,
          message: 'Missing hours found but WhatsApp disabled',
          usersWithMissingHours: result.length
        })
      }

      // Costruisci il messaggio
      let message = '⏰ *PROMEMORIA ORE LAVORATE*\n\n'
      message += `📋 Questi dipendenti devono ancora inserire le ore:\n\n`
      
      result.forEach(user => {
        const turnoLabel = user.count === 1 ? 'turno' : 'turni'
        message += `• *${user.username}* - ${user.count} ${turnoLabel}\n`
      })

      message += `\n📝 Inserisci le ore su:\nhttps://pizzadoc.vercel.app/hours`

      // Invia messaggio
      await whatsappService.sendMessage({ phoneNumber: groupChatId, message })

      console.log(`✅ [CRON hours-reminder] Messaggio inviato con successo al gruppo`)
      console.log(`📊 [CRON hours-reminder] ${result.length} ${result.length === 1 ? 'dipendente' : 'dipendenti'} nella lista`)

      return NextResponse.json({
        success: true,
        message: 'Hours reminder sent successfully',
        usersWithMissingHours: result.length,
        users: result.map(u => ({ username: u.username, missingCount: u.count }))
      })

    } catch (whatsappError) {
      console.error('❌ [CRON hours-reminder] Error sending WhatsApp message:', whatsappError)
      return NextResponse.json({
        success: false,
        error: 'Failed to send WhatsApp message',
        usersWithMissingHours: result.length
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ [CRON hours-reminder] Error in cron job:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}



