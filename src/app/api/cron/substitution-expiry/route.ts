import { NextRequest, NextResponse } from 'next/server'
import { getCronAuthFailureResponse } from '@/lib/cron-auth'
import { expireSubstitutionsPastDeadline } from '@/lib/substitution-expiry'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Segna EXPIRED le richieste PENDING senza candidato dopo l’inizio turno (deadline).
 * Utile anche quando nessuno apre l’app subito dopo lo scadere della finestra.
 */
export async function GET(request: NextRequest) {
  try {
    const authFailure = getCronAuthFailureResponse(request)
    if (authFailure) {
      return authFailure
    }

    const isVercelCron = request.headers.get('x-vercel-cron') !== null

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
