import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/user/leaves/check?weekStart=2025-01-06 - Check if user has approved leaves in a specific week
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')

    if (!weekStartParam) {
      return NextResponse.json(
        { error: 'weekStart parameter required' },
        { status: 400 }
      )
    }

    const weekStart = new Date(weekStartParam)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    // Trova vacanze approvate che si sovrappongono con questa settimana
    const overlappingLeaves = await prisma.leave.findMany({
      where: {
        userId: session.user.id,
        status: 'APPROVED',
        OR: [
          {
            // Leave inizia durante la settimana
            startDate: {
              gte: weekStart,
              lte: weekEnd
            }
          },
          {
            // Leave finisce durante la settimana
            endDate: {
              gte: weekStart,
              lte: weekEnd
            }
          },
          {
            // Leave copre tutta la settimana
            startDate: {
              lte: weekStart
            },
            endDate: {
              gte: weekEnd
            }
          }
        ]
      },
      orderBy: {
        startDate: 'asc'
      }
    })

    return NextResponse.json({
      hasApprovedLeaves: overlappingLeaves.length > 0,
      leaves: overlappingLeaves
    })
  } catch (error) {
    console.error('Error checking leaves:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
