import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addWeekCalendarDays, getNextWeekStart } from '@/lib/date-utils'
import { normalizeDate } from '@/lib/normalize-date'

/**
 * TEST Endpoint: Mostra il messaggio che verrebbe inviato senza inviarlo realmente
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 TEST: Generating availability reminder message...')

    const weekStart = normalizeDate(getNextWeekStart())
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

    console.log(`📅 Checking availability for week: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`)
    console.log(`📅 WeekStart as string: "${weekStart.toISOString()}"`)

    // Trova tutti gli utenti attivi con disponibilità e assenze
    const activeUsers = await prisma.user.findMany({
      where: { 
        isActive: true,
        whatsappNotificationsEnabled: true // ⭐ FILTRA SOLO utenti con notifiche abilitate
      },
      select: {
        id: true,
        username: true,
        phoneNumber: true,
        whatsappNotificationsEnabled: true, // Includi per debug
        availabilities: {
          where: { 
            weekStart: {
              equals: weekStart
            }
          },
          select: { 
            id: true, 
            weekStart: true,
            dayOfWeek: true,
            shiftType: true,
            isAvailable: true
          }
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
      
      // Log dettagliato per utenti con assenze
      if (user.absences.length > 0) {
        console.log(`📊 ${user.username}: ${user.absences.length} absences, covering ${coveredDays.size}/7 days`, {
          absences: user.absences.map(a => ({
            start: a.startDate.toISOString(),
            end: a.endDate.toISOString()
          })),
          coveredDays: Array.from(coveredDays).sort()
        })
      }
      
      return hasNoAvailability && isNotAdmin && hasLessThan7Absences
    })

    console.log(`📊 Found ${usersWithoutAvailability.length} users without availability`)

    // Genera il messaggio che verrebbe inviato
    let message = ''
    
    if (usersWithoutAvailability.length > 0) {
      message = `
⏰ *PROMEMORIA DISPONIBILITÀ*

📅 Ricordatevi di inserire le vostre disponibilità per la prossima settimana.

👥 *Utenti che non hanno ancora inserito le disponibilità:*
${usersWithoutAvailability.map(u => `• ${u.username}`).join('\n')}

🔗 Inserisci le tue disponibilità: https://pizzadoc.vercel.app/availability
      `.trim()
    } else {
      message = '✅ Tutti gli utenti hanno già inserito le disponibilità per la prossima settimana!'
    }

    // Recupera impostazioni WhatsApp per info
    const [groupChatIdSetting, notificationsEnabledSetting] = await Promise.all([
      prisma.systemSettings.findUnique({ where: { key: 'whatsapp_group_chat_id' } }),
      prisma.systemSettings.findUnique({ where: { key: 'whatsapp_notifications_enabled' } })
    ])

    const groupChatId = groupChatIdSetting?.value
    const notificationsEnabled = notificationsEnabledSetting?.value === 'true'

    return NextResponse.json({
      success: true,
      test: true,
      info: {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        totalActiveUsers: activeUsers.length,
        usersWithoutAvailability: usersWithoutAvailability.length,
        notificationsEnabled,
        groupChatId,
        wouldSendMessage: notificationsEnabled && groupChatId && usersWithoutAvailability.length > 0
      },
      users: {
        withAvailability: activeUsers
          .filter(u => u.availabilities.some(a => a.isAvailable === true))
          .map(u => ({
            username: u.username,
            hasAvailability: true,
            availabilityCount: u.availabilities.length,
            availabilities: u.availabilities.map(a => ({
              weekStart: a.weekStart.toISOString(),
              dayOfWeek: a.dayOfWeek,
              shiftType: a.shiftType,
              isAvailable: a.isAvailable
            }))
          })),
        withoutAvailability: usersWithoutAvailability.map(u => {
          // Calcola i giorni coperti per questo utente (per debug)
          let coveredDays = new Set<number>()
          for (const absence of u.absences) {
            const absenceStart = new Date(Math.max(absence.startDate.getTime(), weekStart.getTime()))
            const absenceEnd = new Date(Math.min(absence.endDate.getTime(), weekEnd.getTime()))
            
            const startDay = Math.floor((absenceStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
            const endDay = Math.floor((absenceEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
            
            for (let day = startDay; day <= endDay; day++) {
              if (day >= 0 && day <= 6) {
                coveredDays.add(day)
              }
            }
          }
          
          return {
            username: u.username,
            phoneNumber: u.phoneNumber,
            hasAvailability: u.availabilities.length > 0,
            absencesCount: u.absences.length,
            daysCoveredByAbsences: coveredDays.size,
            absences: u.absences.map(a => ({
              start: a.startDate.toISOString(),
              end: a.endDate.toISOString()
            }))
          }
        }),
        skippedDueToFullWeekAbsence: activeUsers
          .filter(user => {
            const hasNoAvailability = user.availabilities.length === 0
            const isNotAdmin = user.username.toLowerCase() !== 'admin'
            
            let coveredDays = new Set<number>()
            for (const absence of user.absences) {
              const absenceStart = new Date(Math.max(absence.startDate.getTime(), weekStart.getTime()))
              const absenceEnd = new Date(Math.min(absence.endDate.getTime(), weekEnd.getTime()))
              
              const startDay = Math.floor((absenceStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
              const endDay = Math.floor((absenceEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
              
              for (let day = startDay; day <= endDay; day++) {
                if (day >= 0 && day <= 6) {
                  coveredDays.add(day)
                }
              }
            }
            
            const hasFullWeekAbsence = coveredDays.size === 7
            
            return hasNoAvailability && isNotAdmin && hasFullWeekAbsence
          })
          .map(u => {
            let coveredDays = new Set<number>()
            for (const absence of u.absences) {
              const absenceStart = new Date(Math.max(absence.startDate.getTime(), weekStart.getTime()))
              const absenceEnd = new Date(Math.min(absence.endDate.getTime(), weekEnd.getTime()))
              
              const startDay = Math.floor((absenceStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
              const endDay = Math.floor((absenceEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
              
              for (let day = startDay; day <= endDay; day++) {
                if (day >= 0 && day <= 6) {
                  coveredDays.add(day)
                }
              }
            }
            
            return {
              username: u.username,
              coveredDays: 7,
              absences: u.absences.map(a => ({
                start: a.startDate.toISOString(),
                end: a.endDate.toISOString()
              }))
            }
          })
      },
      message: {
        text: message,
        length: message.length
      }
    })
  } catch (error) {
    console.error('❌ Error in availability reminder test:', error)
    return NextResponse.json(
      { 
        success: false,
        test: true,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

