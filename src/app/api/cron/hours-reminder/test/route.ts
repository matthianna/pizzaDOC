import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * TEST ENDPOINT: Mostra il messaggio del promemoria ore senza inviarlo
 * Accessibile solo agli ADMIN
 * URL: /api/cron/hours-reminder/test
 */
export async function GET(request: NextRequest) {
  try {
    // 🔒 Solo admin possono testare
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 401 })
    }

    console.log('🧪 [TEST hours-reminder] Starting test mode...')

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
          trackHours: true
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
          trackHours: true
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

    console.log(`🧪 [TEST hours-reminder] Turni senza ore: ${shiftsWithoutHours.length}`)
    console.log(`🧪 [TEST hours-reminder] Turni con ore rifiutate: ${shiftsWithRejectedHours.length}`)
    console.log(`🧪 [TEST hours-reminder] Utenti con ore mancanti: ${result.length}`)

    // Verifica configurazione WhatsApp
    const [groupChatIdSetting, notificationsEnabledSetting] = await Promise.all([
      prisma.systemSettings.findUnique({ where: { key: 'whatsapp_group_chat_id' } }),
      prisma.systemSettings.findUnique({ where: { key: 'whatsapp_notifications_enabled' } })
    ])

    const groupChatId = groupChatIdSetting?.value
    const notificationsEnabled = notificationsEnabledSetting?.value === 'true'

    // Costruisci il messaggio (anche se vuoto)
    let message = ''
    let wouldSend = false

    if (result.length > 0) {
      message = '⏰ *PROMEMORIA ORE LAVORATE*\n\n'
      message += `📋 Questi dipendenti devono ancora inserire le ore:\n\n`
      
      result.forEach(user => {
        const turnoLabel = user.count === 1 ? 'turno' : 'turni'
        message += `• *${user.username}* - ${user.count} ${turnoLabel}\n`
      })

      message += `\n📝 Inserisci le ore su:\nhttps://pizzadoc.vercel.app/hours`

      // Determina se verrebbe inviato
      wouldSend = notificationsEnabled && !!groupChatId
    }

    return NextResponse.json({
      testMode: true,
      timestamp: new Date().toISOString(),
      statistics: {
        shiftsWithoutHours: shiftsWithoutHours.length,
        shiftsWithRejectedHours: shiftsWithRejectedHours.length,
        totalShifts: allShifts.length,
        usersWithMissingHours: result.length
      },
      whatsappConfig: {
        notificationsEnabled,
        groupConfigured: !!groupChatId,
        groupChatId: groupChatId || null
      },
      wouldSendMessage: wouldSend,
      message: message || '(Nessun messaggio da inviare - nessuna ora mancante)',
      users: result.length > 0 ? result : [],
      reasons: {
        noMissingHours: result.length === 0,
        whatsappDisabled: !notificationsEnabled,
        groupNotConfigured: !groupChatId
      }
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })

  } catch (error) {
    console.error('❌ [TEST hours-reminder] Error in test:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}



