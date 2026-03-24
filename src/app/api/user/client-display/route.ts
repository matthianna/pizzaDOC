import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED = new Set(['standalone', 'fullscreen', 'browser'])

// POST /api/user/client-display — heartbeat: how the user is running the app (PWA vs browser)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const displayMode = typeof body.displayMode === 'string' ? body.displayMode : ''
    if (!ALLOWED.has(displayMode)) {
      return NextResponse.json({ error: 'displayMode non valido' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastClientDisplayMode: displayMode,
        lastClientDisplayModeAt: new Date()
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[client-display]', error)
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}
