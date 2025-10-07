import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/substitutions/[id]/reject - Reject substitution
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { responseNote } = await request.json()

    const substitution = await prisma.substitutions.findUnique({
      where: { id: id },
      include: {
        shift: {
          include: {
            user: true
          }
        }
      }
    })

    if (!substitution) {
      return NextResponse.json(
        { error: 'Substitution not found' },
        { status: 404 }
      )
    }

    // Only the original shift owner or admin can reject
    const isOwner = substitution.shift.userId === session.user.id
    const isAdmin = session.user.roles.includes('ADMIN')

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to reject this substitution' },
        { status: 403 }
      )
    }

    if (substitution.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Substitution already processed' },
        { status: 400 }
      )
    }

    await prisma.substitutions.update({
      where: { id: id },
      data: {
        status: 'REJECTED',
        approverId: session.user.id,
        responseNote: responseNote || null
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error rejecting substitution:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
