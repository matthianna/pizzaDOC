import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isPriorityUser } from '@/lib/utils'
import { createDatabaseBackup } from '@/lib/database-backup'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * CRON JOB: Promemoria ore lavorate mancanti + Backup Database
 * Eseguito ogni giovedì alle 15:00 CEST (13:00 UTC)
 * 
 * 1. Crea un backup automatico del database
 * 2. Invia notifiche push agli utenti con ore mancanti
 */
export async function GET(request: NextRequest) {
  try {
    // 🔒 Verifica autenticazione
    const authHeader = request.headers.get('authorization')
    const vercelCronHeader = request.headers.get('x-vercel-cron')
    const cronSecret = process.env.CRON_SECRET

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

    // 📦 STEP 1: Backup automatico del database
    let backupResult = null
    try {
      console.log('💾 [CRON hours-reminder] Creating automatic database backup...')
      backupResult = await createDatabaseBackup()
      
      if (backupResult.success) {
        console.log(`✅ [CRON hours-reminder] Backup completed: ${backupResult.timestamp}`)
        console.log(`📊 [CRON hours-reminder] Backed up tables:`, backupResult.tables)
        
        // Log the backup in audit log - find an admin user for the log
        try {
          const adminUser = await prisma.user.findFirst({
            where: {
              user_roles: {
                some: {
                  role: 'ADMIN'
                }
              }
            },
            select: { id: true, username: true }
          })
          
          if (adminUser) {
            await prisma.audit_logs.create({
              data: {
                id: crypto.randomUUID(),
                userId: adminUser.id,
                userUsername: `SYSTEM (${adminUser.username})`,
                action: 'DATABASE_BACKUP',
                description: `Backup automatico eseguito durante hours-reminder cron`,
                metadata: {
                  timestamp: backupResult.timestamp,
                  tables: backupResult.tables,
                  triggeredBy: 'hours-reminder-cron',
                  automatic: true
                }
              }
            })
            console.log('📝 [CRON] Backup logged to audit trail')
          }
        } catch (logError) {
          console.error('⚠️ [CRON] Failed to log backup to audit:', logError)
        }
      } else {
        console.error('❌ [CRON hours-reminder] Backup failed:', backupResult.error)
      }
    } catch (backupError) {
      console.error('❌ [CRON hours-reminder] Backup error:', backupError)
    }

    // 📋 STEP 2: Check for missing hours
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Query 1: Turni senza ORE (nessuna riga in worked_hours)
    const initialShiftsWithoutHours = await prisma.shifts.findMany({
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
    const initialShiftsWithRejectedHours = await prisma.shifts.findMany({
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

    // Filtra per escludere gli ADMIN (eccetto i VIP)
    const shiftsWithoutHours = initialShiftsWithoutHours.filter(s => 
      s.user.primaryRole !== 'ADMIN' || isPriorityUser(s.user.username)
    )
    const shiftsWithRejectedHours = initialShiftsWithRejectedHours.filter(s => 
      s.user.primaryRole !== 'ADMIN' || isPriorityUser(s.user.username)
    )

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
      b.count - a.count
    )

    console.log(`📊 [CRON hours-reminder] Turni senza ore: ${shiftsWithoutHours.length}`)
    console.log(`📊 [CRON hours-reminder] Turni con ore rifiutate: ${shiftsWithRejectedHours.length}`)
    console.log(`📊 [CRON hours-reminder] Utenti con ore mancanti: ${result.length}`)

    // Se non ci sono ore mancanti
    if (result.length === 0) {
      console.log('✅ [CRON hours-reminder] Nessuna ora mancante.')
      return NextResponse.json({
        success: true,
        message: 'No missing hours to report',
        usersWithMissingHours: 0,
        backup: backupResult ? {
          success: backupResult.success,
          timestamp: backupResult.timestamp,
          tables: backupResult.tables
        } : null
      })
    }

    // 🔔 Send Push Notifications
    try {
      const { createNotification } = await import('@/lib/notifications')
      const { NotificationType } = await import('@prisma/client')

      console.log('🔔 Sending push notifications to', result.length, 'users')

      const pushResults = await Promise.allSettled(
        Object.entries(groupedByUser).map(async ([userId, data]) => {
          try {
            await createNotification({
              userId: userId,
              type: NotificationType.HOURS_REMINDER,
              title: 'Promemoria Ore Lavorate',
              body: `Hai ${data.count} ${data.count === 1 ? 'turno' : 'turni'} senza ore inserite. Ricordati di completarle!`,
              data: {
                url: '/hours'
              }
            })
            return { success: true, userId }
          } catch (error) {
            console.error(`❌ Failed to send push to ${data.username}:`, error)
            return { success: false, userId, error }
          }
        })
      )

      const successfulPush = pushResults.filter(r => r.status === 'fulfilled' && (r.value as any).success).length
      console.log(`✅ Push notifications sent: ${successfulPush}/${result.length}`)
    } catch (notifError) {
      console.error('❌ [CRON] Error sending notifications:', notifError)
    }

    return NextResponse.json({
      success: true,
      message: 'Hours reminder completed',
      usersWithMissingHours: result.length,
      users: result.map(u => ({ username: u.username, missingCount: u.count })),
      backup: backupResult ? {
        success: backupResult.success,
        timestamp: backupResult.timestamp,
        tables: backupResult.tables
      } : null
    })
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
