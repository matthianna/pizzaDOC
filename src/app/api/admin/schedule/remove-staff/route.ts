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

    // Delete the shift
    await prisma.shift.delete({
      where: { id: shiftId }
    })

    // Optionally log the removal reason
    console.log(`Shift ${shiftId} removed by ${session.user.username}. Reason: ${reason || 'N/A'}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing staff:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
