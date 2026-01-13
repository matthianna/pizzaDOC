import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-logger'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Find the absence
    const absence = await prisma.absences.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    })

    if (!absence) {
      return NextResponse.json({ error: 'Absence not found' }, { status: 404 })
    }

    // Update absence
    const updated = await prisma.absences.update({
      where: { id },
      data: {
        approved: true,
        approvedBy: session.user.id,
        updatedAt: new Date()
      }
    })

    // Log audit action
    await logAuditAction({
      userId: session.user.id,
      action: 'ABSENCE_APPROVE',
      tableName: 'absences',
      recordId: id,
      changes: {
        approved: true,
        approvedBy: session.user.id
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error approving absence:', error)
    return NextResponse.json(
      { error: 'Failed to approve absence' },
      { status: 500 }
    )
  }
}
