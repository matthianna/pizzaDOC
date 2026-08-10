import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const base = {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }

  try {
    // Lightweight connectivity check — do not expose counts or DB error details
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json(base)
  } catch (e) {
    console.error('[health] DB check failed:', e)
    return NextResponse.json(
      {
        status: 'error',
        timestamp: base.timestamp,
        version: base.version,
        message: 'Database unreachable',
      },
      { status: 503 }
    )
  }
}
