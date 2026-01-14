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

        // Trova tutti gli utenti che hanno turni in questa settimana
        const shifts = await prisma.shifts.findMany({
            where: {
                schedules: {
                    weekStart: weekStartDate
                }
            },
            select: {
                userId: true
            }
        })

        const uniqueUserIds = [...new Set(shifts.map(s => s.userId))]

        if (uniqueUserIds.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'Nessun turno trovato per questa settimana. Genera prima il piano.'
            }, { status: 404 })
        }

        const formattedDate = format(weekStartDate, 'dd/MM/yyyy', { locale: it })

        // Invia notifiche
        const results = await Promise.allSettled(uniqueUserIds.map(userId =>
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

        // Log audit
        await logAuditAction({
            userId: session.user.id,
            userUsername: session.user.username,
            action: 'TASK_RUN' as any,
            description: `Inviate notifiche piano settimanale per ${formattedDate}`,
            metadata: {
                weekStart: weekStartDate.toISOString(),
                usersNotified: successful,
                totalUsers: uniqueUserIds.length
            }
        })

        return NextResponse.json({
            success: true,
            message: `Notifiche inviate a ${successful} utenti su ${uniqueUserIds.length}`,
            successful,
            total: uniqueUserIds.length
        })
    } catch (error) {
        console.error('Error sending schedule notifications:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
