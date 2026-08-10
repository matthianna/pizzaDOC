import { NextRequest, NextResponse } from 'next/server'

/**
 * Cron endpoints require Authorization: Bearer CRON_SECRET always.
 * Vercel Cron sends this automatically when CRON_SECRET is set in the project.
 * Do not trust spoofable headers like x-vercel-cron alone.
 */
export function getCronAuthFailureResponse(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        hint: 'CRON_SECRET is not configured on the server.',
      },
      { status: 401 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        hint: 'Use Authorization: Bearer <CRON_SECRET>.',
      },
      { status: 401 }
    )
  }

  return null
}
