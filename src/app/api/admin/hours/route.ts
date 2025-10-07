import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/hours - Get all hours for review
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    const whereClause: {
      status?: string;
      user?: {
        id: string;
      };
    } = {}

    if (status) {
      whereClause.status = status
    }

    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
      const endDate = new Date(parseInt(year), parseInt(month), 0)
      whereClause.shifts = {
        schedules: {
          weekStart: {
            gte: startDate,
            lte: endDate
          }
        }
      }
    }

    const workedHours = await prisma.worked_hours.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        },
        shifts: {
          include: {
            schedules: true
          }
        }
      },
      orderBy: {
        submittedAt: 'desc'
      }
    })

    // Map shifts -> shift and schedules -> schedule for frontend compatibility
    const mapped = workedHours.map((wh: any) => ({
      ...wh,
      shift: {
        ...wh.shifts,
        schedule: {
          weekStart: wh.shifts.schedules.weekStart
        }
      }
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    console.error('Error fetching hours for review:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
