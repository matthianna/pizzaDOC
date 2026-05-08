import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hashPassword } from '@/lib/utils'

const BCRYPT_COST = 12

/**
 * POST /api/admin/bcrypt-hash — genera hash bcrypt (stesso algoritmo del login).
 * Solo ADMIN. Non loggare mai la password in chiaro.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!password) {
      return NextResponse.json({ error: 'Inserisci una password' }, { status: 400 })
    }
    if (password.length > 512) {
      return NextResponse.json({ error: 'Password troppo lunga (max 512 caratteri)' }, { status: 400 })
    }

    const hash = await hashPassword(password)

    return NextResponse.json({
      hash,
      cost: BCRYPT_COST,
      note: 'Copia il valore "hash" nella colonna password della tabella users (es. da SQL o console DB).',
    })
  } catch (error) {
    console.error('bcrypt-hash error')
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
