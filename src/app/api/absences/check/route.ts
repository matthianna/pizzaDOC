import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/absences/check?startDate=...&endDate=... - Check if user has absence in date range
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ error: 'Missing date parameters' }, { status: 400 })
    }

    const startDate = new Date(startDateParam)
    const endDate = new Date(endDateParam)

    // Find overlapping absences
    const absences = await prisma.absence.findMany({
      where: {
        userId: session.user.id,
        OR: [
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } }
            ]
          }
        ]
      },
      orderBy: { startDate: 'asc' }
    })

    // Return absences grouped by date
    const absencesByDate: Record<string, boolean> = {}
    
    absences.forEach(absence => {
      const current = new Date(absence.startDate)
      const end = new Date(absence.endDate)
      
      while (current <= end) {
        const dateKey = current.toISOString().split('T')[0]
        absencesByDate[dateKey] = true
        current.setDate(current.getDate() + 1)
      }
    })

    return NextResponse.json({
      hasAbsence: absences.length > 0,
      absences,
      absencesByDate
    })
  } catch (error) {
    console.error('Error checking absences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

