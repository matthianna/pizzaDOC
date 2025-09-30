import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth-utils'

// POST /api/admin/leaves/[id]/reject - Reject leave request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id } = resolvedParams

    const leave = await prisma.leave.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            username: true
          }
        }
      }
    })

    if (!leave) {
      return NextResponse.json(
        { error: 'Richiesta di assenza non trovata' },
        { status: 404 }
      )
    }

    if (leave.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Solo le richieste in attesa possono essere rifiutate' },
        { status: 400 }
      )
    }

    const updatedLeave = await prisma.leave.update({
      where: { id },
      data: {
        status: 'REJECTED'
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        }
      }
    })

    return NextResponse.json(updatedLeave)
  } catch (error) {
    console.error('Error rejecting leave:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
