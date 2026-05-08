import { NextRequest, NextResponse } from 'next/server'
import { expireSubstitutionsPastDeadline } from '@/lib/substitution-expiry'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Segna EXPIRED le richieste PENDING senza candidato dopo l’inizio turno (deadline).
 * Utile anche quando nessuno apre l’app subito dopo lo scadere della finestra.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const vercelCronHeader = request.headers.get('x-vercel-cron')
    const cronSecret = process.env.CRON_SECRET

    const isVercelCron = vercelCronHeader !== null
    const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isVercelCron && cronSecret && !hasValidSecret) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          hint: 'Use Authorization: Bearer <CRON_SECRET> header or wait for Vercel Cron',
        },
        { status: 401 }
      )
    }

    const result = await expireSubstitutionsPastDeadline()

    return NextResponse.json({
      ok: true,
      expiredCount: result.count,
      triggeredBy: isVercelCron ? 'Vercel Cron' : 'Manual',
    })
  } catch (error) {
    console.error('[CRON substitution-expiry]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
