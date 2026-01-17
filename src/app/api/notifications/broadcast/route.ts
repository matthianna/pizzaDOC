import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { createNotification, sendPushToUsers } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'
import { getNextWeekStart } from '@/lib/date-utils'

// POST /api/notifications/broadcast - Send notification to all users
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
        }

        const body = await request.json()
        const { title, message, url, filter } = body

        if (!title || !message) {
            return NextResponse.json({ error: 'Titolo e messaggio richiesti' }, { status: 400 })
        }

        let userIds: string[] = []

        if (filter === 'missing_availability') {
            const nextWeek = getNextWeekStart()
            const usersWithAvail = await prisma.availabilities.findMany({
                where: { weekStart: nextWeek },
                select: { userId: true },
                distinct: ['userId']
            })
            const userIdsWithAvail = usersWithAvail.map(a => a.userId)

            const targetUsers = await prisma.user.findMany({
                where: {
                    isActive: true,
                    id: { notIn: userIdsWithAvail }
                },
                select: { id: true }
            })
            userIds = targetUsers.map(u => u.id)
        } else {
            // Get all active users
            const users = await prisma.user.findMany({
                where: { isActive: true },
                select: { id: true }
            })
            userIds = users.map(u => u.id)
        }

        // Create notifications in database
        await prisma.notifications.createMany({
            data: userIds.map(userId => ({
                id: crypto.randomUUID(),
                userId,
                type: 'GENERAL' as NotificationType,
                title,
                body: message,
                data: { url: url || '/dashboard' },
                isRead: false,
                sentAt: new Date()
            }))
        })

        // Send push notifications
        const pushResult = await sendPushToUsers(userIds, {
            title,
            body: message,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            data: {
                url: url || '/dashboard',
                type: 'GENERAL'
            },
            tag: 'general-broadcast'
        })

        return NextResponse.json({
            success: true,
            recipients: userIds.length,
            pushResult
        })
    } catch (error) {
        console.error('[API] Error sending broadcast notification:', error)
        return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }
}
