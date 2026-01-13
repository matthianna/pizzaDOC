import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/push/subscribe - Subscribe to push notifications
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
        }

        const body = await request.json()
        const { subscription } = body

        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
            return NextResponse.json({ error: 'Dati sottoscrizione non validi' }, { status: 400 })
        }

        // Check if subscription already exists
        const existing = await prisma.push_subscriptions.findUnique({
            where: { endpoint: subscription.endpoint }
        })

        if (existing) {
            // Update existing subscription
            await prisma.push_subscriptions.update({
                where: { id: existing.id },
                data: {
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth,
                    userAgent: request.headers.get('user-agent') || undefined,
                    updatedAt: new Date()
                }
            })
        } else {
            // Create new subscription
            await prisma.push_subscriptions.create({
                data: {
                    userId: session.user.id,
                    endpoint: subscription.endpoint,
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth,
                    userAgent: request.headers.get('user-agent') || undefined
                }
            })
        }

        // Enable push notifications for user if not already
        await prisma.user.update({
            where: { id: session.user.id },
            data: { pushNotificationsEnabled: true }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Error subscribing to push:', error)
        return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }
}

// DELETE /api/push/subscribe - Unsubscribe from push notifications
export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
        }

        const body = await request.json()
        const { endpoint } = body

        if (!endpoint) {
            return NextResponse.json({ error: 'Endpoint mancante' }, { status: 400 })
        }

        // Delete subscription
        await prisma.push_subscriptions.deleteMany({
            where: {
                userId: session.user.id,
                endpoint
            }
        })

        // Check if user has any remaining subscriptions
        const remainingCount = await prisma.push_subscriptions.count({
            where: { userId: session.user.id }
        })

        // If no subscriptions left, disable push notifications
        if (remainingCount === 0) {
            await prisma.user.update({
                where: { id: session.user.id },
                data: { pushNotificationsEnabled: false }
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Error unsubscribing from push:', error)
        return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }
}
