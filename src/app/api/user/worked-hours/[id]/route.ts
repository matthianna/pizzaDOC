import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PUT — disabilitato: solo gli admin modificano le ore
export async function PUT() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user.id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  return NextResponse.json(
    {
      error:
        'Le ore possono essere inserite o corrette solo dall’amministrazione. Contatta un amministratore.',
    },
    { status: 403 }
  )
}
