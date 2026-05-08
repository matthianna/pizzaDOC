import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const base = {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }

  try {
    const userCount = await prisma.user.count()
    return NextResponse.json({
      ...base,
      userCount,
    })
  } catch (e) {
    console.error('[health] DB check failed:', e)
    return NextResponse.json(
      {
        status: 'error',
        timestamp: base.timestamp,
        version: base.version,
        message: e instanceof Error ? e.message : 'Database unreachable',
        userCount: null,
      },
      { status: 503 }
    )
  }
}
