import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// GET /api/admin/shift-limits - Get all shift limits
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const shiftLimits = await prisma.shift_limits.findMany({
      orderBy: [
        { dayOfWeek: 'asc' },
        { shiftType: 'asc' },
        { role: 'asc' }
      ]
    })

    return NextResponse.json(shiftLimits)
  } catch (error) {
    console.error('Error fetching shift limits:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/shift-limits - Update shift limits
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { limits } = await request.json()

    if (!limits || !Array.isArray(limits)) {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      )
    }

    // Update each shift limit
    const now = new Date()
    for (const limit of limits) {
      await prisma.shift_limits.upsert({
        where: {
          dayOfWeek_shiftType_role: {
            dayOfWeek: limit.dayOfWeek,
            shiftType: limit.shiftType,
            role: limit.role
          }
        },
        update: {
          minStaff: limit.minStaff,
          maxStaff: limit.maxStaff,
          updatedAt: now
        },
        create: {
          id: crypto.randomUUID(),
          dayOfWeek: limit.dayOfWeek,
          shiftType: limit.shiftType,
          role: limit.role,
          minStaff: limit.minStaff,
          maxStaff: limit.maxStaff,
          updatedAt: now
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating shift limits:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
