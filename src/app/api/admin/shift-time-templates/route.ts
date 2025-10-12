import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth-utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const templates = await prisma.shift_start_time_templates.findMany({
      orderBy: [
        { shiftType: 'asc' },
        { role: 'asc' },
        { priority: 'desc' }
      ]
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error fetching shift time templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { shiftType, role, startTime, priority, description, isActive } = body

    const template = await prisma.shift_start_time_templates.create({
      data: {
        id: crypto.randomUUID(),
        shiftType,
        role,
        startTime,
        priority: priority || 0,
        description,
        isActive: isActive !== undefined ? isActive : true,
        updatedAt: new Date()
      }
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Error creating shift time template:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

