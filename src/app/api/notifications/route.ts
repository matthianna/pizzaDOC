import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserNotifications, markAllAsRead, getUnreadCount } from '@/lib/notifications'

// GET /api/notifications - Get user's notifications
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '20')
        const offset = parseInt(searchParams.get('offset') || '0')
        const unreadOnly = searchParams.get('unreadOnly') === 'true'

        const result = await getUserNotifications(session.user.id, {
            limit,
            offset,
            unreadOnly
        })

        return NextResponse.json(result)
    } catch (error) {
        console.error('[API] Error fetching notifications:', error)
        return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }
}

// POST /api/notifications - Mark all as read
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
        }

        const body = await request.json()
        const { action } = body

        if (action === 'markAllRead') {
            await markAllAsRead(session.user.id)
            const unreadCount = await getUnreadCount(session.user.id)
            return NextResponse.json({ success: true, unreadCount })
        }

        return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
    } catch (error) {
        console.error('[API] Error updating notifications:', error)
        return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }
}
