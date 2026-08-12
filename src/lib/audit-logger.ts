import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { AuditActionType } from '@prisma/client'

interface AuditLogData {
  userId: string
  userUsername: string
  action: AuditActionType
  description: string
  metadata?: Record<string, any>
}

/**
 * Registra un'azione nel sistema di audit log
 */
export async function logAuditAction(data: AuditLogData): Promise<void> {
  try {
    // Ottieni IP e User Agent dalle headers
    const headersList = await headers()
    const ipAddress =
      headersList.get('x-forwarded-for')?.split(',')[0] ||
      headersList.get('x-real-ip') ||
      headersList.get('cf-connecting-ip') ||
      'unknown'

    const userAgent = headersList.get('user-agent') || 'unknown'

    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        userId: data.userId,
        userUsername: data.userUsername,
        action: data.action,
        description: data.description,
        ipAddress,
        userAgent,
        metadata: data.metadata || {},
        createdAt: new Date()
      }
    })

    console.log(`[AUDIT] ${data.action} by ${data.userUsername} (${ipAddress}): ${data.description}`)
  } catch (error) {
    console.error('[AUDIT] Failed to log action:', error)
    // Non blocchiamo l'operazione se il log fallisce
  }
}

/**
 * Recupera i log di audit con filtri
 */
export async function getAuditLogs(filters?: {
  userId?: string
  action?: AuditActionType
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}) {
  const where: any = {}

  if (filters?.userId) where.userId = filters.userId
  if (filters?.action) where.action = filters.action
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = filters.startDate
    if (filters.endDate) where.createdAt.lte = filters.endDate
  }

  const [logs, total] = await Promise.all([
    prisma.audit_logs.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
      skip: filters?.offset || 0,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        }
      }
    }),
    prisma.audit_logs.count({ where })
  ])

  return { logs, total }
}

/**
 * Contatori aggregati per la dashboard Sistema.
 */
export async function getAuditStats() {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7)) // lunedì

  const [total, today, thisWeek, backupsCount, lastBackup, topActions] = await Promise.all([
    prisma.audit_logs.count(),
    prisma.audit_logs.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.audit_logs.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.audit_logs.count({ where: { action: 'DATABASE_BACKUP' } }),
    prisma.audit_logs.findFirst({
      where: { action: 'DATABASE_BACKUP' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.audit_logs.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 8,
    }),
  ])

  return {
    total,
    today,
    thisWeek,
    backupsCount,
    lastBackup: lastBackup?.createdAt ?? null,
    topActions: topActions.map((row) => ({
      action: row.action,
      count: row._count.action,
    })),
  }
}

/**
 * Cancella i log di audit. Di default lascia i record di backup database.
 */
export async function clearAuditLogs(options?: {
  keepBackups?: boolean
  actor?: { userId: string; username: string }
}) {
  const keepBackups = options?.keepBackups !== false

  const where = keepBackups ? { action: { not: 'DATABASE_BACKUP' as const } } : {}

  const result = await prisma.audit_logs.deleteMany({ where })

  if (options?.actor) {
    await logAuditAction({
      userId: options.actor.userId,
      userUsername: options.actor.username,
      action: 'TASK_RUN',
      description: keepBackups
        ? `Pulizia audit log: eliminati ${result.count} eventi (backup conservati)`
        : `Pulizia audit log: eliminati ${result.count} eventi`,
      metadata: {
        deletedCount: result.count,
        keepBackups,
      },
    })
  }

  return { deletedCount: result.count, keepBackups }
}

