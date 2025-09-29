import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth-utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { targetCount, isActive } = body

    // Valida targetCount se fornito
    if (targetCount !== undefined && (!Number.isInteger(targetCount) || targetCount < 0)) {
      return NextResponse.json(
        { error: 'Target count deve essere un numero intero positivo' },
        { status: 400 }
      )
    }

    const distribution = await prisma.shiftStartTimeDistribution.update({
      where: { id: params.id },
      data: {
        ...(targetCount !== undefined && { targetCount }),
        ...(isActive !== undefined && { isActive })
      }
    })

    return NextResponse.json(distribution)
  } catch (error) {
    console.error('Error updating start time distribution:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await prisma.shiftStartTimeDistribution.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Distribution deleted' })
  } catch (error) {
    console.error('Error deleting start time distribution:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

