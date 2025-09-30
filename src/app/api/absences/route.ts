import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/absences - Get user's absences
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const absences = await prisma.absence.findMany({
      where: { userId: session.user.id },
      orderBy: { startDate: 'desc' }
    })

    return NextResponse.json(absences)
  } catch (error) {
    console.error('Error fetching absences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/absences - Create absence
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { startDate, endDate, type, reason } = await request.json()

    // Validation
    const start = new Date(startDate)
    const end = new Date(endDate)
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    if (start < now) {
      return NextResponse.json({ error: 'Cannot create absence in the past' }, { status: 400 })
    }

    if (end < start) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }

    const absence = await prisma.absence.create({
      data: {
        userId: session.user.id,
        startDate: start,
        endDate: end,
        type,
        reason
      }
    })

    return NextResponse.json(absence)
  } catch (error) {
    console.error('Error creating absence:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
