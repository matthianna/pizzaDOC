import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LeaveType } from '@prisma/client'

// GET /api/user/leaves - Get user's own leaves
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const leaves = await prisma.leave.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        startDate: 'desc'
      }
    })

    return NextResponse.json(leaves)
  } catch (error) {
    console.error('Error fetching leaves:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/user/leaves - Create new leave request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { startDate, endDate, type, reason } = await request.json()

    // Validazioni
    const start = new Date(startDate)
    const end = new Date(endDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (start < today) {
      return NextResponse.json(
        { error: 'Non puoi creare vacanze nel passato' },
        { status: 400 }
      )
    }

    if (end < start) {
      return NextResponse.json(
        { error: 'La data di fine deve essere posteriore alla data di inizio' },
        { status: 400 }
      )
    }

    if (!Object.values(LeaveType).includes(type)) {
      return NextResponse.json(
        { error: 'Tipo di assenza non valido' },
        { status: 400 }
      )
    }

    // Verifica sovrapposizioni con altre vacanze già approvate/in attesa
    const overlappingLeaves = await prisma.leave.findMany({
      where: {
        userId: session.user.id,
        status: {
          in: ['PENDING', 'APPROVED']
        },
        OR: [
          {
            startDate: {
              lte: end
            },
            endDate: {
              gte: start
            }
          }
        ]
      }
    })

    if (overlappingLeaves.length > 0) {
      return NextResponse.json(
        { error: 'Hai già una richiesta di assenza in queste date' },
        { status: 400 }
      )
    }

    const leave = await prisma.leave.create({
      data: {
        userId: session.user.id,
        startDate: start,
        endDate: end,
        type,
        reason: reason || null
      }
    })

    return NextResponse.json(leave, { status: 201 })
  } catch (error) {
    console.error('Error creating leave:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
