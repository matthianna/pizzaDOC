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

    const distributions = await prisma.shift_start_time_distributions.findMany({
      orderBy: [
        { shiftType: 'asc' },
        { role: 'asc' },
        { startTime: 'asc' }
      ]
    })

    return NextResponse.json(distributions)
  } catch (error) {
    console.error('Error fetching start time distributions:', error)
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
    const { shiftType, role, startTime, targetCount } = body

    // Valida formato orario (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(startTime)) {
      return NextResponse.json(
        { error: 'Formato orario non valido. Usa HH:MM' },
        { status: 400 }
      )
    }

    // Valida targetCount
    if (!Number.isInteger(targetCount) || targetCount < 0) {
      return NextResponse.json(
        { error: 'Target count deve essere un numero intero positivo' },
        { status: 400 }
      )
    }

    const distribution = await prisma.shift_start_time_distributions.upsert({
      where: {
        shiftType_role_startTime: {
          shiftType,
          role,
          startTime
        }
      },
      update: {
        targetCount,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        id: crypto.randomUUID(),
        shiftType,
        role,
        startTime,
        targetCount,
        isActive: true,
        updatedAt: new Date()
      }
    })

    return NextResponse.json(distribution, { status: 201 })
  } catch (error) {
    console.error('Error creating/updating start time distribution:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

