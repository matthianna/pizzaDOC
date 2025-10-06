import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDate } from '@/lib/normalize-date'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')
    
    if (!weekStartParam) {
      return NextResponse.json({ error: 'Week start parameter is required' }, { status: 400 })
    }

    const weekStart = normalizeDate(weekStartParam)

    // Trova il piano per questa settimana
    const schedule = await prisma.schedule.findUnique({
      where: { weekStart },
      include: {
        shifts: {
          where: {
            userId: session.user.id
          },
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            },
            workedHours: {
              select: {
                id: true,
                status: true,
                totalHours: true
              }
            }
          },
          orderBy: [
            { dayOfWeek: 'asc' },
            { shiftType: 'asc' }
          ]
        }
      }
    })

    if (!schedule) {
      return NextResponse.json([])
    }

    return NextResponse.json(schedule.shifts)
  } catch (error) {
    console.error('Error fetching user schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
