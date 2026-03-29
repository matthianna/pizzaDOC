import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMaxEngagementSnoozesPerType } from '@/lib/engagement-limits'

// GET — snooze windows + counts (server source of truth for banner)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const max = getMaxEngagementSnoozesPerType()
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        engagementPwaSnoozeCount: true,
        engagementPwaSnoozedUntil: true,
        engagementPushSnoozeCount: true,
        engagementPushSnoozedUntil: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    const now = new Date()
    const pwaHidden = !!(user.engagementPwaSnoozedUntil && user.engagementPwaSnoozedUntil > now)
    const pushHidden = !!(user.engagementPushSnoozedUntil && user.engagementPushSnoozedUntil > now)

    return NextResponse.json({
      maxSnoozesPerType: max,
      pwa: {
        snoozeCount: user.engagementPwaSnoozeCount,
        snoozedUntil: user.engagementPwaSnoozedUntil?.toISOString() ?? null,
        hiddenNow: pwaHidden,
        snoozesRemaining: Math.max(0, max - user.engagementPwaSnoozeCount),
        canSnooze: user.engagementPwaSnoozeCount < max
      },
      push: {
        snoozeCount: user.engagementPushSnoozeCount,
        snoozedUntil: user.engagementPushSnoozedUntil?.toISOString() ?? null,
        hiddenNow: pushHidden,
        snoozesRemaining: Math.max(0, max - user.engagementPushSnoozeCount),
        canSnooze: user.engagementPushSnoozeCount < max
      }
    })
  } catch (e) {
    console.error('[engagement-state]', e)
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}
