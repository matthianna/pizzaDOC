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

    // Calcola quali giorni della settimana sono coperti da vacanze
    const leaveDays: number[] = [] // 0=Lunedì, 6=Domenica
    
    for (let dayOffset = 0; dayOffset <= 6; dayOffset++) {
      const currentDay = new Date(weekStart)
      currentDay.setDate(currentDay.getDate() + dayOffset)
      currentDay.setHours(0, 0, 0, 0)
      
      // Verifica se questo giorno è coperto da qualche vacanza
      const isDayOnLeave = overlappingLeaves.some(leave => {
        const leaveStart = new Date(leave.startDate)
        const leaveEnd = new Date(leave.endDate)
        leaveStart.setHours(0, 0, 0, 0)
        leaveEnd.setHours(23, 59, 59, 999)
        
        return currentDay >= leaveStart && currentDay <= leaveEnd
      })
      
      if (isDayOnLeave) {
        leaveDays.push(dayOffset)
      }
    }

    return NextResponse.json({
      hasApprovedLeaves: overlappingLeaves.length > 0,
      leaves: overlappingLeaves,
      leaveDays // Array di giorni in vacanza (0=Lun, 1=Mar, ..., 6=Dom)
    })
  } catch (error) {
    console.error('Error checking leaves:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
