import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PUT /api/hours/[id] — legacy disabilitato
export async function PUT() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(
    {
      error:
        'Le ore possono essere modificate solo dall’amministrazione. Contatta un amministratore.',
    },
    { status: 403 }
  )
}

// DELETE /api/hours/[id] — legacy disabilitato
export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(
    {
      error:
        'Le ore possono essere gestite solo dall’amministrazione. Contatta un amministratore.',
    },
    { status: 403 }
  )
}
