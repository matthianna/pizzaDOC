import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export type AuditActionType =
  | 'SCHEDULE_GENERATE'
  | 'SCHEDULE_DELETE'
  | 'SHIFT_ADD'
  | 'SHIFT_DELETE'
  | 'SHIFT_EDIT'
  | 'USER_CREATE'
  | 'USER_DELETE'
  | 'USER_EDIT'
  | 'HOURS_APPROVE'
  | 'HOURS_REJECT'
  | 'HOURS_EDIT'
  | 'ABSENCE_CREATE'
  | 'ABSENCE_DELETE'
  | 'ABSENCE_EDIT'
  | 'SUBSTITUTION_APPROVE'
  | 'SUBSTITUTION_REJECT'
  | 'DATABASE_RESET'
  | 'DATABASE_BACKUP'
  | 'SETTINGS_CHANGE'

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

