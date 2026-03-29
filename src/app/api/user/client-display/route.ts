import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_MODE = new Set(['standalone', 'fullscreen', 'browser'])
const ALLOWED_PERM = new Set(['default', 'granted', 'denied'])

// POST /api/user/client-display — display mode + optional notification audit fields
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const displayMode = typeof body.displayMode === 'string' ? body.displayMode : ''
    if (!ALLOWED_MODE.has(displayMode)) {
      return NextResponse.json({ error: 'displayMode non valido' }, { status: 400 })
    }

    const notificationPermission =
      typeof body.notificationPermission === 'string' && ALLOWED_PERM.has(body.notificationPermission)
        ? body.notificationPermission
        : undefined

    const hasPushSubscription =
      typeof body.hasPushSubscription === 'boolean' ? body.hasPushSubscription : undefined

    const now = new Date()

    const isPwaSurface = displayMode === 'standalone' || displayMode === 'fullscreen'

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastClientDisplayMode: displayMode,
        lastClientDisplayModeAt: now,
        ...(notificationPermission
          ? {
              notificationPermissionReported: notificationPermission,
              notificationPermissionReportedAt: now
            }
          : {}),
        ...(hasPushSubscription !== undefined
          ? {
              clientPushSubscribedReported: hasPushSubscription,
              clientPushSubscribedReportedAt: now
            }
          : {}),
        ...(isPwaSurface ? { engagementPwaSnoozedUntil: null } : {}),
        ...(hasPushSubscription === true ? { engagementPushSnoozedUntil: null } : {}),
        updatedAt: now
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[client-display]', error)
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}
