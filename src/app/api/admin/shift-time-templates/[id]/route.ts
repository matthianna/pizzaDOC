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
    const { startTime, endTime, priority, description, isActive } = body

    const template = await prisma.shiftTimeTemplate.update({
      where: { id: params.id },
      data: {
        startTime,
        endTime,
        priority,
        description,
        isActive
      }
    })

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error updating shift time template:', error)
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

    await prisma.shiftTimeTemplate.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Template deleted' })
  } catch (error) {
    console.error('Error deleting shift time template:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

