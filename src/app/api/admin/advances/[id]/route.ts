import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// PUT /api/admin/advances/[id] - Update an advance
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id } = resolvedParams
    const body = await request.json()
    const { amount, date, notes } = body

    // Find existing advance
    const existingAdvance = await prisma.advances.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            username: true
          }
        }
      }
    })

    if (!existingAdvance) {
      return NextResponse.json(
        { error: 'Advance not found' },
        { status: 404 }
      )
    }

    // Validation
    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    // Update advance
    const updatedAdvance = await prisma.advances.update({
      where: { id },
      data: {
        amount: amount !== undefined ? amount : undefined,
        date: date ? new Date(date) : undefined,
        notes: notes !== undefined ? notes : undefined,
        updatedAt: new Date()
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

    // Log audit
    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'SETTINGS_CHANGE',
      description: `Acconto modificato per ${existingAdvance.user.username}`,
      metadata: {
        advanceId: id,
        targetUserId: existingAdvance.userId,
        targetUsername: existingAdvance.user.username,
        oldAmount: existingAdvance.amount,
        newAmount: updatedAdvance.amount,
        oldDate: existingAdvance.date,
        newDate: updatedAdvance.date
      }
    })

    return NextResponse.json(updatedAdvance)
  } catch (error) {
    console.error('Error updating advance:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/advances/[id] - Delete an advance
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id } = resolvedParams

    // Find existing advance
    const existingAdvance = await prisma.advances.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            username: true
          }
        }
      }
    })

    if (!existingAdvance) {
      return NextResponse.json(
        { error: 'Advance not found' },
        { status: 404 }
      )
    }

    // Delete advance
    await prisma.advances.delete({
      where: { id }
    })

    // Log audit
    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'SETTINGS_CHANGE',
      description: `Acconto eliminato per ${existingAdvance.user.username}: CHF ${existingAdvance.amount}`,
      metadata: {
        advanceId: id,
        targetUserId: existingAdvance.userId,
        targetUsername: existingAdvance.user.username,
        amount: existingAdvance.amount,
        date: existingAdvance.date
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting advance:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

