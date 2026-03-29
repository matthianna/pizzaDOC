import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ENGAGEMENT_SNOOZE_HOURS, getMaxEngagementSnoozesPerType } from '@/lib/engagement-limits'

// POST body: { type: 'pwa' | 'push' }
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const type = body.type === 'pwa' || body.type === 'push' ? body.type : null
    if (!type) {
      return NextResponse.json({ error: 'type non valido' }, { status: 400 })
    }

    const max = getMaxEngagementSnoozesPerType()
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        engagementPwaSnoozeCount: true,
        engagementPushSnoozeCount: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    const count = type === 'pwa' ? user.engagementPwaSnoozeCount : user.engagementPushSnoozeCount
    if (count >= max) {
      return NextResponse.json(
        {
          error: `Hai usato tutte le posticipazioni (${max} per categoria).`,
          code: 'SNOOZE_LIMIT',
          maxSnoozesPerType: max
        },
        { status: 403 }
      )
    }

    const until = new Date(Date.now() + ENGAGEMENT_SNOOZE_HOURS * 60 * 60 * 1000)

    if (type === 'pwa') {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          engagementPwaSnoozeCount: { increment: 1 },
          engagementPwaSnoozedUntil: until,
          updatedAt: new Date()
        }
      })
    } else {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          engagementPushSnoozeCount: { increment: 1 },
          engagementPushSnoozedUntil: until,
          updatedAt: new Date()
        }
      })
    }

    const updated = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        engagementPwaSnoozeCount: true,
        engagementPwaSnoozedUntil: true,
        engagementPushSnoozeCount: true,
        engagementPushSnoozedUntil: true
      }
    })

    const now = new Date()
    const u = updated!

    const pwaHidden = !!(u.engagementPwaSnoozedUntil && u.engagementPwaSnoozedUntil > now)
    const pushHidden = !!(u.engagementPushSnoozedUntil && u.engagementPushSnoozedUntil > now)

    return NextResponse.json({
      ok: true,
      maxSnoozesPerType: max,
      pwa: {
        snoozeCount: u.engagementPwaSnoozeCount,
        snoozedUntil: u.engagementPwaSnoozedUntil?.toISOString() ?? null,
        hiddenNow: pwaHidden,
        snoozesRemaining: Math.max(0, max - u.engagementPwaSnoozeCount),
        canSnooze: u.engagementPwaSnoozeCount < max
      },
      push: {
        snoozeCount: u.engagementPushSnoozeCount,
        snoozedUntil: u.engagementPushSnoozedUntil?.toISOString() ?? null,
        hiddenNow: pushHidden,
        snoozesRemaining: Math.max(0, max - u.engagementPushSnoozeCount),
        canSnooze: u.engagementPushSnoozeCount < max
      }
    })
  } catch (e) {
    console.error('[engagement-snooze]', e)
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}
