import { NextRequest, NextResponse } from 'next/server'

/**
 * Su Vercel (VERCEL=1) richiede header x-vercel-cron (scheduler) oppure Bearer CRON_SECRET.
 * In locale: se CRON_SECRET è impostato, richiedilo per chiamate manuali senza header cron.
 */
export function getCronAuthFailureResponse(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization')
  const vercelCronHeader = request.headers.get('x-vercel-cron')
  const cronSecret = process.env.CRON_SECRET

  const isVercelCron = vercelCronHeader !== null
  const hasValidSecret = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)

  if (process.env.VERCEL === '1') {
    if (!isVercelCron && !hasValidSecret) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          hint:
            'Su Vercel questi endpoint accettano solo il cron scheduler (header x-vercel-cron) o Authorization: Bearer CRON_SECRET.',
        },
        { status: 401 }
      )
    }
  } else if (cronSecret && !hasValidSecret && !isVercelCron) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        hint: 'Use Authorization: Bearer <CRON_SECRET> or invoke from Vercel Cron.',
      },
      { status: 401 }
    )
  }

  return null
}
