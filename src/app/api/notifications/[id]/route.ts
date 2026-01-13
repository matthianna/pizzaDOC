import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deleteNotification } from '@/lib/notifications'

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
        }

        const { id } = await params
        await deleteNotification(session.user.id, id)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Error deleting notification:', error)
        return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
    }
}
