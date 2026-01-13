import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { markAsRead } from '@/lib/notifications'

// POST /api/notifications/[id]/read - Mark notification as read
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
        }

        const { id } = await params

        await markAsRead(session.user.id, [id])

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Error marking notification as read:', error)
        return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }
}
