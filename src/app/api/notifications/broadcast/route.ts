import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdmin } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { createNotification, sendPushToUsers } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'
import { appTodayUtcMidnight, getNextWeekStart, shiftCalendarDateUtc, shiftInstantRome } from '@/lib/date-utils'
import { isPriorityUser } from '@/lib/utils'

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
                select: { id: true, username: true, primaryRole: true }
            })
            userIds = targetUsers
                .filter(u => u.primaryRole !== 'ADMIN' || isPriorityUser(u.username))
                .map(u => u.id)
        } else if (filter === 'missing_hours') {
            const todayOps = appTodayUtcMidnight()

            const pastShifts = await prisma.shifts.findMany({
                where: {
                    schedules: {
                        weekStart: {
                            lt: todayOps,
                        },
                    },
                    user: {
                        isActive: true,
                        trackHours: true
                    }
                },
                include: {
                    worked_hours: true,
                    schedules: true,
                    user: {
                        select: { id: true, username: true, primaryRole: true }
                    }
                }
            })

            const targetUserIds = new Set<string>()
            pastShifts.forEach((shift) => {
                const shiftDay = shiftCalendarDateUtc(shift.schedules.weekStart, shift.dayOfWeek)
                const endInst = shiftInstantRome(shiftDay, shift.endTime)

                if (
                    endInst.getTime() < Date.now() &&
                    (!shift.worked_hours || shift.worked_hours.status === 'REJECTED')
                ) {
                    // Solo se non è admin o se è un VIP
                    if (shift.user.primaryRole !== 'ADMIN' || isPriorityUser(shift.user.username)) {
                        targetUserIds.add(shift.userId)
                    }
                }
            })
            userIds = Array.from(targetUserIds)
        } else {
            // Get all active users
            const users = await prisma.user.findMany({
                where: { 
                    isActive: true
                },
                select: { id: true, username: true, primaryRole: true }
            })
            userIds = users
                .filter(u => u.primaryRole !== 'ADMIN' || isPriorityUser(u.username))
                .map(u => u.id)
        }

        // Create notifications in database
        await prisma.notifications.createMany({
            data: userIds.map(userId => ({
                id: crypto.randomUUID(),
                userId,
                type: (filter === 'missing_hours' ? 'HOURS_REMINDER' : 'GENERAL') as NotificationType,
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
                type: filter === 'missing_hours' ? 'HOURS_REMINDER' : 'GENERAL'
            },
            tag: filter === 'missing_hours' ? 'hours-reminder' : 'general-broadcast'
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

// GET /api/notifications/broadcast - Get stats for filters
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
        }

        const stats: any = {}

        // --- Availability Stats ---
        const nextWeek = getNextWeekStart()
        const usersWithAvail = await prisma.availabilities.findMany({
            where: { weekStart: nextWeek },
            select: {
                userId: true,
                user: { select: { username: true } }
            },
            distinct: ['userId']
        })
        const submittedAvailIds = usersWithAvail.map(a => a.userId)
        const submittedAvailNames = Array.from(new Set(usersWithAvail.map(a => a.user.username)))

        const activeUsers = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, username: true, primaryRole: true }
        })

        const filteredActiveUsers = activeUsers.filter(u => u.primaryRole !== 'ADMIN' || isPriorityUser(u.username))
        const filteredActiveIds = filteredActiveUsers.map(u => u.id)

        stats.availability = {
            weekStart: nextWeek,
            submitted: filteredActiveUsers
                .filter(u => submittedAvailIds.includes(u.id))
                .map(u => u.username)
                .sort(),
            missing: filteredActiveUsers
                .filter(u => !submittedAvailIds.includes(u.id))
                .map(u => u.username)
                .sort()
        }

        // --- Hours Stats ---
        const todayOps = appTodayUtcMidnight()

        const pastShifts = await prisma.shifts.findMany({
            where: {
                schedules: {
                    weekStart: { lt: todayOps },
                },
                user: {
                    isActive: true,
                    trackHours: true
                }
            },
            include: {
                worked_hours: true,
                schedules: true,
                user: { select: { username: true, primaryRole: true } }
            }
        })

        const missingHoursUsers = new Set<string>()
        const submittedHoursUsers = new Set<string>()

        pastShifts.forEach((shift) => {
            const shiftDay = shiftCalendarDateUtc(shift.schedules.weekStart, shift.dayOfWeek)
            const endInst = shiftInstantRome(shiftDay, shift.endTime)

            if (endInst.getTime() < Date.now()) {
                // Solo se non è admin o se è un VIP
                if (shift.user.primaryRole !== 'ADMIN' || isPriorityUser(shift.user.username)) {
                    if (!shift.worked_hours || shift.worked_hours.status === 'REJECTED') {
                        missingHoursUsers.add(shift.user.username)
                    } else {
                        submittedHoursUsers.add(shift.user.username)
                    }
                }
            }
        })

        const finalizedMissing = Array.from(missingHoursUsers).sort()
        const finalizedSubmitted = Array.from(submittedHoursUsers)
            .filter(name => !missingHoursUsers.has(name))
            .sort()

        stats.hours = {
            submitted: finalizedSubmitted,
            missing: finalizedMissing
        }

        return NextResponse.json(stats)
    } catch (error) {
        console.error('[API] Error fetching broadcast stats:', error)
        return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }
}
