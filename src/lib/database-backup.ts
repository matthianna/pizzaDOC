import { prisma } from './prisma'
import { format } from 'date-fns'

interface BackupResult {
  success: boolean
  data?: any
  tables?: Record<string, number>
  timestamp?: string
  error?: string
}

/**
 * Crea un backup completo del database come JSON
 * Funziona su Vercel serverless
 */
export async function createDatabaseBackup(): Promise<BackupResult> {
  try {
    console.log('[BACKUP] Starting database backup...')
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss')

    // Export all tables - using correct Prisma model names
    const [
      users,
      schedules,
      shifts,
      availabilities,
      workedHours,
      absences,
      holidays,
      notifications,
      substitutions,
      systemSettings,
      auditLogs,
      pushSubscriptions,
      userTransports,
      userRoles,
      advances,
      shiftLimits,
      shiftStartTimeTemplates,
      shiftStartTimeDistributions
    ] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          primaryRole: true,
          primaryTransport: true,
          isActive: true,
          trackHours: true,
          whatsappNotificationsEnabled: true,
          pushNotificationsEnabled: true,
          phoneNumber: true,
          isFirstLogin: true,
          createdAt: true,
          updatedAt: true,
          // Don't include password hash for security
        }
      }),
      prisma.schedules.findMany(),
      prisma.shifts.findMany(),
      prisma.availabilities.findMany(),
      prisma.worked_hours.findMany(),
      prisma.absences.findMany(),
      prisma.holidays.findMany(),
      prisma.notifications.findMany({
        take: 1000,
        orderBy: { sentAt: 'desc' }
      }),
      prisma.substitutions.findMany(),
      prisma.systemSettings.findMany(),
      prisma.audit_logs.findMany({
        take: 500,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.push_subscriptions.findMany(),
      prisma.user_transports.findMany(),
      prisma.user_roles.findMany(),
      prisma.advances.findMany(),
      prisma.shift_limits.findMany(),
      prisma.shift_start_time_templates.findMany(),
      prisma.shift_start_time_distributions.findMany()
    ])

    const backupData = {
      metadata: {
        timestamp,
        createdAt: new Date().toISOString(),
        version: '1.0',
        type: 'full_backup'
      },
      tables: {
        users,
        schedules,
        shifts,
        availabilities,
        workedHours,
        absences,
        holidays,
        notifications,
        substitutions,
        systemSettings,
        auditLogs,
        pushSubscriptions,
        userTransports,
        userRoles,
        advances,
        shiftLimits,
        shiftStartTimeTemplates,
        shiftStartTimeDistributions
      }
    }

    const tableCounts: Record<string, number> = {
      users: users.length,
      schedules: schedules.length,
      shifts: shifts.length,
      availabilities: availabilities.length,
      workedHours: workedHours.length,
      absences: absences.length,
      holidays: holidays.length,
      notifications: notifications.length,
      substitutions: substitutions.length,
      systemSettings: systemSettings.length,
      auditLogs: auditLogs.length,
      pushSubscriptions: pushSubscriptions.length,
      userTransports: userTransports.length,
      userRoles: userRoles.length,
      advances: advances.length,
      shiftLimits: shiftLimits.length,
      shiftStartTimeTemplates: shiftStartTimeTemplates.length,
      shiftStartTimeDistributions: shiftStartTimeDistributions.length
    }

    const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0)
    console.log(`[BACKUP] ✅ Backup completed: ${totalRecords} records from ${Object.keys(tableCounts).length} tables`)

    return {
      success: true,
      data: backupData,
      tables: tableCounts,
      timestamp
    }
  } catch (error: any) {
    console.error('[BACKUP] ❌ Failed to create backup:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Esegue un backup e registra nel log di audit
 */
export async function scheduleBackup(userId?: string, username?: string) {
  const result = await createDatabaseBackup()
  
  if (result.success && userId && username) {
    try {
      const { logAuditAction } = await import('./audit-logger')
      await logAuditAction({
        userId,
        userUsername: username,
        action: 'DATABASE_BACKUP',
        description: `Backup database creato: ${result.timestamp}`,
        metadata: {
          timestamp: result.timestamp,
          tables: result.tables
        }
      })
    } catch (e) {
      console.error('[BACKUP] Failed to log audit action:', e)
    }
  }

  return result
}

/**
 * Lista backups - ora restituisce info sull'ultimo backup dal log
 */
export async function listBackups() {
  try {
    // Get backup history from audit logs
    const backupLogs = await prisma.audit_logs.findMany({
      where: {
        action: 'DATABASE_BACKUP'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    })

    return backupLogs.map(log => ({
      filename: `backup_${format(log.createdAt, 'yyyyMMdd_HHmmss')}.json`,
      path: 'In-memory backup',
      size: 0,
      sizeReadable: 'N/A',
      createdAt: log.createdAt,
      metadata: log.metadata
    }))
  } catch (error) {
    console.error('[BACKUP] Error listing backups:', error)
    return []
  }
}

/**
 * Cleanup non più necessario con backup in-memory
 */
export async function cleanOldBackups(daysToKeep: number = 30) {
  return { deletedCount: 0 }
}
