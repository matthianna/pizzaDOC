import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { shiftId, reason } = await request.json()

    if (!shiftId) {
      return NextResponse.json(
        { error: 'Missing shiftId' },
        { status: 400 }
      )
    }

    // Get shift data before deleting (to get username)
    const shift = await prisma.shifts.findUnique({
      where: { id: shiftId },
      include: {
        user: {
          select: {
            username: true
          }
        }
      }
    })

    if (!shift) {
      return NextResponse.json(
        { error: 'Turno non trovato' },
        { status: 404 }
      )
    }

    // Delete the shift
    await prisma.shifts.delete({
      where: { id: shiftId }
    })

    // Optionally log the removal reason
    console.log(`Shift ${shiftId} removed by ${session.user.username}. User: ${shift.user.username}. Reason: ${reason || 'N/A'}`)

    return NextResponse.json({ 
      success: true,
      username: shift.user.username
    })
  } catch (error) {
    console.error('Error removing staff:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
