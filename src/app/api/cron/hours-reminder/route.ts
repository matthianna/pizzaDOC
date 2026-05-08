import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isPriorityUser } from '@/lib/utils'
import { appTodayUtcMidnight, shiftCalendarDateUtc, shiftInstantRome } from '@/lib/date-utils'
import { createDatabaseBackup } from '@/lib/database-backup'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * CRON JOB: Promemoria ore lavorate mancanti (per admin) + Backup Database
 * Eseguito ogni giovedì alle 15:00 CEST (13:00 UTC)
 *
 * 1. Crea un backup automatico del database
 * 2. Invia notifiche push agli amministratori se ci sono turni senza ore o con ore rifiutate
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

    const todayOps = appTodayUtcMidnight()

    const initialShiftsWithoutHours = await prisma.shifts.findMany({
      where: {
        schedules: {
          weekStart: {
            lt: todayOps,
          },
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
            lt: todayOps,
          },
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
      .map((shift) => {
        const shiftDay = shiftCalendarDateUtc(shift.schedules.weekStart, shift.dayOfWeek)
        const endInst = shiftInstantRome(shiftDay, shift.endTime)

        return {
          userId: shift.user.id,
          username: shift.user.username,
          shiftDate: shiftDay,
          endMs: endInst.getTime(),
        }
      })
      .filter((shift) => shift.endMs < Date.now())

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
    console.log(`📊 [CRON hours-reminder] Utenti coinvolti: ${result.length}, turni da sistemare: ${missingHours.length}`)

    // Se non ci sono ore mancanti
    if (missingHours.length === 0) {
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

    // 🔔 Notifiche agli amministratori
    try {
      const { createNotification } = await import('@/lib/notifications')
      const { NotificationType } = await import('@prisma/client')

      const admins = await prisma.user.findMany({
        where: {
          isActive: true,
          user_roles: { some: { role: 'ADMIN' } },
        },
        select: { id: true, username: true },
      })

      console.log(
        `🔔 Sending admin hours reminders: ${admins.length} admins, ${missingHours.length} shifts to fix`
      )

      const shiftWord = missingHours.length === 1 ? 'turno' : 'turni'
      const pushResults = await Promise.allSettled(
        admins.map(async (admin) => {
          try {
            await createNotification({
              userId: admin.id,
              type: NotificationType.HOURS_REMINDER,
              title: 'Ore lavorate: azione richiesta',
              body: `Ci sono ${missingHours.length} ${shiftWord} senza ore registrate o con ore rifiutate. Apri Gestione ore per inserirle o correggerle.`,
              data: {
                url: '/admin/hours',
              },
            })
            return { success: true, userId: admin.id }
          } catch (error) {
            console.error(`❌ Failed to send admin push to ${admin.username}:`, error)
            return { success: false, userId: admin.id, error }
          }
        })
      )

      const successfulPush = pushResults.filter(
        (r) => r.status === 'fulfilled' && (r.value as { success?: boolean }).success
      ).length
      console.log(`✅ Admin push notifications sent: ${successfulPush}/${admins.length}`)
    } catch (notifError) {
      console.error('❌ [CRON] Error sending notifications:', notifError)
    }

    return NextResponse.json({
      success: true,
      message: 'Hours reminder completed (admins notified)',
      shiftsWithMissingHours: missingHours.length,
      usersAffected: result.length,
      users: result.map((u) => ({ username: u.username, missingCount: u.count })),
      backup: backupResult
        ? {
            success: backupResult.success,
            timestamp: backupResult.timestamp,
            tables: backupResult.tables,
          }
        : null,
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
