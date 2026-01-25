import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/user/push-status - Check if user has push notifications enabled
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        pushNotificationsEnabled: true,
        push_subscriptions: {
          select: {
            id: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ enabled: false, hasSubscription: false })
    }

    const hasSubscription = user.push_subscriptions.length > 0
    const enabled = user.pushNotificationsEnabled && hasSubscription

    return NextResponse.json({
      enabled,
      hasSubscription,
      pushNotificationsEnabled: user.pushNotificationsEnabled
    })
  } catch (error) {
    console.error('[API] Error checking push status:', error)
    return NextResponse.json({ enabled: false, hasSubscription: false })
  }
}
