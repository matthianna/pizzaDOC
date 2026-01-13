import { NextResponse } from 'next/server'

// GET /api/push/vapid-key - Get public VAPID key for push subscription
export async function GET() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    if (!vapidKey) {
        return NextResponse.json({
            error: 'Notifiche push non configurate'
        }, { status: 503 })
    }

    return NextResponse.json({ publicKey: vapidKey })
}
