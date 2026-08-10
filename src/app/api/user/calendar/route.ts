import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  calendarFeedUrls,
  generateCalendarToken,
  resolvePublicOrigin,
} from '@/lib/calendar-ics'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function ensureCalendarToken(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { calendarToken: true },
  })

  if (existing?.calendarToken) {
    return existing.calendarToken
  }

  // Retry on rare unique collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = generateCalendarToken()
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { calendarToken: token },
      })
      return token
    } catch {
      // unique conflict — retry
    }
  }

  throw new Error('Unable to allocate calendar token')
}

function urlsForRequest(request: NextRequest, token: string) {
  const origin = resolvePublicOrigin(request.url)
  return calendarFeedUrls(origin, token)
}

/** GET: ensure token exists and return subscribe URLs. */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const token = await ensureCalendarToken(session.user.id)
    const { httpsUrl, webcalUrl } = urlsForRequest(request, token)

    return NextResponse.json(
      { httpsUrl, webcalUrl, token },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching calendar subscribe URL:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST: regenerate calendar token (invalidates old subscriptions). */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    let token = generateCalendarToken()
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { calendarToken: token },
        })
        break
      } catch {
        token = generateCalendarToken()
        if (attempt === 2) throw new Error('Unable to rotate calendar token')
      }
    }

    const { httpsUrl, webcalUrl } = urlsForRequest(request, token)

    return NextResponse.json({
      httpsUrl,
      webcalUrl,
      token,
      regenerated: true,
    })
  } catch (error) {
    console.error('Error regenerating calendar token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
