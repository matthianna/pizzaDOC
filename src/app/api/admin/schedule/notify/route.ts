import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'
import { logAuditAction } from '@/lib/audit-logger'
import { createNotification } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { weekStart } = await request.json()

        if (!weekStart) {
            return NextResponse.json(
                { error: 'Week start required' },
                { status: 400 }
            )
        }

        const weekStartDate = normalizeDate(weekStart)
        console.log(`[NOTIFY] Sending notifications for week starting ${weekStartDate.toISOString()}`)

        // Trova lo schedule per questa settimana
        const schedule = await prisma.schedules.findUnique({
            where: { weekStart: weekStartDate },
            include: {
                shifts: {
                    select: {
                        userId: true
                    }
                }
            }
        })

        if (!schedule || schedule.shifts.length === 0) {
            console.log(`[NOTIFY] No schedule or shifts found for ${weekStartDate.toISOString()}`)

            // Debug: list existing schedules
            const allSchedules = await prisma.schedules.findMany({
                take: 10,
                orderBy: { weekStart: 'desc' },
                select: { weekStart: true }
            })
            console.log(`[NOTIFY] Existing schedules:`, allSchedules.map(s => s.weekStart.toISOString()))

            return NextResponse.json({
                success: false,
                error: 'Piano non trovato per questa settimana',
                message: `Cercato: ${weekStartDate.toISOString()}. Trovati: ${allSchedules.map(s => s.weekStart.toISOString().split('T')[0]).join(', ')}`,
                debug: {
                    searched: weekStartDate.toISOString(),
                    existing: allSchedules.map(s => s.weekStart.toISOString())
                }
            }, { status: 404 })
        }

        const uniqueUserIds = [...new Set(schedule.shifts.map(s => s.userId))]
        console.log(`[NOTIFY] Found ${uniqueUserIds.length} unique users to notify`)

        // ⭐ Filtra per escludere gli ADMIN
        const usersToNotify = await prisma.user.findMany({
            where: {
                id: { in: uniqueUserIds },
                primaryRole: { not: 'ADMIN' }
            },
            select: { id: true }
        })

        const finalUserIds = usersToNotify.map(u => u.id)
        console.log(`[NOTIFY] After filtering admins, ${finalUserIds.length} users remain to notify`)

        const formattedDate = format(weekStartDate, 'dd/MM/yyyy', { locale: it })

        // Invia notifiche
        const results = await Promise.allSettled(finalUserIds.map(userId =>
            createNotification({
                userId,
                type: NotificationType.SCHEDULE_PUBLISHED,
                title: 'Nuovo Orario Pubblicato',
                body: `È stato pubblicato l'orario per la settimana del ${formattedDate}.`,
                data: {
                    url: '/schedule',
                    weekStart: weekStartDate.toISOString()
                }
            })
        ))

        const successful = results.filter(r => r.status === 'fulfilled').length
        const failed = results.filter(r => r.status === 'rejected')

        if (failed.length > 0) {
            console.error(`[NOTIFY] ${failed.length} notifications failed. First error:`, (failed[0] as any).reason)
        }

        // Get usernames for feedback
        const notifiedUsers = await prisma.user.findMany({
            where: { id: { in: uniqueUserIds } },
            select: { username: true }
        })
        const usernames = notifiedUsers.map((u: { username: string }) => u.username)

        console.log(`[NOTIFY] Successfully sent ${successful} notifications out of ${uniqueUserIds.length}`)

        // Log audit
        await logAuditAction({
            userId: session.user.id,
            userUsername: session.user.username,
            action: 'SETTINGS_CHANGE' as any, // Temporary fix for missing TASK_RUN in DB enum
            description: `Inviate notifiche piano settimanale per ${formattedDate} a: ${usernames.join(', ')}`,
            metadata: {
                weekStart: weekStartDate.toISOString(),
                usersNotified: successful,
                totalUsers: uniqueUserIds.length,
                failedCount: failed.length,
                usernames,
                errors: failed.slice(0, 5).map(f => String((f as any).reason))
            }
        })

        if (successful === 0 && uniqueUserIds.length > 0) {
            return NextResponse.json({
                success: false,
                error: 'Tutte le notifiche sono fallite',
                details: failed.map(f => String((f as any).reason))
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: `Notifiche inviate a ${successful} utenti: ${usernames.join(', ')}`,
            successful,
            total: uniqueUserIds.length,
            failed: failed.length,
            usernames
        })
    } catch (error: any) {
        console.error('Error sending schedule notifications:', error)
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        )
    }
}
