import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { createNotification, sendPushToUsers } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'

// POST /api/notifications/broadcast - Send notification to all users
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
        }

        const body = await request.json()
        const { title, message, url } = body

        if (!title || !message) {
            return NextResponse.json({ error: 'Titolo e messaggio richiesti' }, { status: 400 })
        }

        // Get all active users
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true }
        })

        const userIds = users.map(u => u.id)

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
