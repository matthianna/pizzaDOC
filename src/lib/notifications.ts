import webpush from 'web-push'
import { prisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'

// VAPID keys should be generated once and stored in environment variables
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@pizzadoc.it'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

export interface NotificationPayload {
    title: string
    body: string
    icon?: string
    badge?: string
    data?: Record<string, unknown>
    tag?: string
    requireInteraction?: boolean
}

export interface CreateNotificationOptions {
    userId: string
    type: NotificationType
    title: string
    body: string
    data?: Record<string, unknown>
    sendPush?: boolean
}

/**
 * Create a notification and optionally send a push notification
 */
export async function createNotification({
    userId,
    type,
    title,
    body,
    data,
    sendPush = true
}: CreateNotificationOptions) {
    console.log(`[Notification] Creating ${type} notification for user ${userId}`)
    try {
        // Create notification in database
        const notification = await prisma.notifications.create({
            data: {
                userId,
                type,
                title,
                body,
                data: (data as any) || {},
                isRead: false,
                sentAt: new Date()
            }
        })

        // Send push notification if enabled
        if (sendPush) {
            await sendPushNotification(userId, {
                title,
                body,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
                data: {
                    notificationId: notification.id,
                    type,
                    url: getNotificationUrl(type, data),
                    ...data
                },
                tag: type,
                requireInteraction: isImportantNotification(type)
            })
        }

        return notification
    } catch (error) {
        console.error('[Notification] Error creating notification:', error)
        throw error
    }
}

/**
 * Send push notification to a specific user
 */
export async function sendPushNotification(userId: string, payload: NotificationPayload) {
    try {
        // Check if user has push notifications enabled
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { pushNotificationsEnabled: true }
        })

        if (!user?.pushNotificationsEnabled) {
            console.log(`[Push] User ${userId} has push notifications disabled`)
            return { success: false, reason: 'notifications_disabled' }
        }

        // Get user's push subscriptions
        const subscriptions = await prisma.push_subscriptions.findMany({
            where: { userId }
        })

        if (subscriptions.length === 0) {
            console.log(`[Push] No subscriptions found for user ${userId}`)
            return { success: false, reason: 'no_subscriptions' }
        }

        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth
                            }
                        },
                        JSON.stringify(payload)
                    )
                    return { success: true, subscriptionId: sub.id }
                } catch (error: unknown) {
                    const err = error as { statusCode?: number }
                    // If subscription is invalid, delete it
                    if (err.statusCode === 404 || err.statusCode === 410) {
                        console.log(`[Push] Removing invalid subscription ${sub.id}`)
                        await prisma.push_subscriptions.delete({ where: { id: sub.id } })
                    }
                    throw error
                }
            })
        )

        const successful = results.filter(r => r.status === 'fulfilled').length
        const failed = results.filter(r => r.status === 'rejected').length

        console.log(`[Push] Sent to user ${userId}: ${successful} success, ${failed} failed`)

        return { success: successful > 0, sent: successful, failed }
    } catch (error) {
        console.error('[Push] Error sending push notification:', error)
        return { success: false, error }
    }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushToUsers(userIds: string[], payload: NotificationPayload) {
    const results = await Promise.allSettled(
        userIds.map(userId => sendPushNotification(userId, payload))
    )

    return {
        total: userIds.length,
        successful: results.filter(r => r.status === 'fulfilled' && (r.value as { success?: boolean }).success).length,
        failed: results.filter(r => r.status === 'rejected' || !(r.value as { success?: boolean }).success).length
    }
}

/**
 * Get the URL to navigate to for a notification type
 */
function getNotificationUrl(type: NotificationType, data?: Record<string, unknown>): string {
    switch (type) {
        case 'SCHEDULE_PUBLISHED':
        case 'SHIFT_ASSIGNED':
        case 'SHIFT_CHANGED':
        case 'SHIFT_REMOVED':
            return '/schedule'
        case 'HOURS_APPROVED':
        case 'HOURS_REJECTED':
        case 'HOURS_REMINDER':
            return '/hours'
        case 'SUBSTITUTION_REQUEST':
        case 'SUBSTITUTION_APPLIED':
        case 'SUBSTITUTION_APPROVED':
        case 'SUBSTITUTION_REJECTED':
            return '/substitution-requests'
        case 'AVAILABILITY_REMINDER':
            return '/availability'
        default:
            return '/dashboard'
    }
}

/**
 * Determine if a notification should require user interaction
 */
function isImportantNotification(type: NotificationType): boolean {
    return [
        'HOURS_REJECTED',
        'SHIFT_REMOVED',
        'SUBSTITUTION_REJECTED',
        'HOURS_REMINDER'
    ].includes(type)
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
    return prisma.notifications.count({
        where: { userId, isRead: false }
    })
}

/**
 * Mark notifications as read
 */
export async function markAsRead(userId: string, notificationIds: string[]) {
    return prisma.notifications.updateMany({
        where: {
            id: { in: notificationIds },
            userId
        },
        data: {
            isRead: true,
            readAt: new Date()
        }
    })
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
    return prisma.notifications.updateMany({
        where: { userId, isRead: false },
        data: {
            isRead: true,
            readAt: new Date()
        }
    })
}

/**
 * Get user's notifications with pagination
 */
export async function getUserNotifications(userId: string, options?: {
    limit?: number
    offset?: number
    unreadOnly?: boolean
}) {
    const { limit = 20, offset = 0, unreadOnly = false } = options || {}

    const [notifications, total, unreadCount] = await Promise.all([
        prisma.notifications.findMany({
            where: {
                userId,
                ...(unreadOnly ? { isRead: false } : {})
            },
            orderBy: { sentAt: 'desc' },
            take: limit,
            skip: offset
        }),
        prisma.notifications.count({
            where: { userId }
        }),
        prisma.notifications.count({
            where: { userId, isRead: false }
        })
    ])

    return { notifications, total, unreadCount }
}

/**
 * Delete old notifications (older than 30 days)
 */
export async function cleanupOldNotifications() {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const result = await prisma.notifications.deleteMany({
        where: {
            sentAt: { lt: thirtyDaysAgo },
            isRead: true
        }
    })

    console.log(`[Notification] Cleaned up ${result.count} old notifications`)
    return result.count
}

/**
 * Delete a specific notification
 */
export async function deleteNotification(userId: string, notificationId: string) {
    return prisma.notifications.delete({
        where: {
            id: notificationId,
            userId
        }
    })
}

/**
 * Delete all notifications for a user
 */
export async function deleteAllNotifications(userId: string) {
    return prisma.notifications.deleteMany({
        where: { userId }
    })
}
