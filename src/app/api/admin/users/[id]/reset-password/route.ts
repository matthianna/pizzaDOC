import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/utils'
import { logAuditAction } from '@/lib/audit-logger'

const MIN_PASSWORD_LENGTH = 6

// POST /api/admin/users/[id]/reset-password - Reset user password
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      )
    }

    let body: { newPassword?: string } = {}
    try {
      body = await request.json()
    } catch {
      // empty body is fine — default to username
    }

    const customPassword =
      typeof body.newPassword === 'string' ? body.newPassword.trim() : ''

    // Default temporary password = exact username (as stored)
    const temporaryPassword = customPassword || user.username

    if (temporaryPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `La password deve essere di almeno ${MIN_PASSWORD_LENGTH} caratteri. Imposta una password personalizzata.`
        },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(temporaryPassword)

    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        isFirstLogin: true
      }
    })

    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'USER_EDIT',
      description: `Password resettata per utente: ${user.username}`,
      metadata: {
        targetUserId: user.id,
        targetUsername: user.username,
        usedCustomPassword: Boolean(customPassword),
        forcedFirstLogin: true
      }
    })

    return NextResponse.json({
      success: true,
      username: user.username,
      temporaryPassword,
      isFirstLogin: true,
      message:
        'Password resettata. L’utente dovrà cambiare la password al prossimo accesso.'
    })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
