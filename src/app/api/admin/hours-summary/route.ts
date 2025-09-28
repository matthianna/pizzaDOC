import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null

    // Build where clause
    const where: any = {
      status: 'APPROVED' // Solo ore approvate
    }

    if (userId) {
      where.userId = userId
    }

    // Filter by year and optionally month
    const startDate = month 
      ? new Date(year, month - 1, 1) // Specific month
      : new Date(year, 0, 1) // Whole year

    const endDate = month
      ? new Date(year, month, 0, 23, 59, 59) // End of specific month
      : new Date(year, 11, 31, 23, 59, 59) // End of year

    where.submittedAt = {
      gte: startDate,
      lte: endDate
    }

    // Get worked hours with user and shift info
    const workedHours = await prisma.workedHours.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            primaryRole: true
          }
        },
        shift: {
          select: {
            dayOfWeek: true,
            shiftType: true,
            role: true,
            schedule: {
              select: {
                weekStart: true
              }
            }
          }
        }
      },
      orderBy: [
        { user: { username: 'asc' } },
        { submittedAt: 'desc' }
      ]
    })

    // Group by user and month
    const summary: Record<string, {
      user: any
      monthlyHours: Record<string, {
        totalHours: number
        shiftsCount: number
        details: any[]
      }>
      yearlyTotal: number
    }> = {}

    workedHours.forEach(wh => {
      const userId = wh.user.id
      const monthKey = new Date(wh.submittedAt).toISOString().slice(0, 7) // YYYY-MM format

      if (!summary[userId]) {
        summary[userId] = {
          user: wh.user,
          monthlyHours: {},
          yearlyTotal: 0
        }
      }

      if (!summary[userId].monthlyHours[monthKey]) {
        summary[userId].monthlyHours[monthKey] = {
          totalHours: 0,
          shiftsCount: 0,
          details: []
        }
      }

      summary[userId].monthlyHours[monthKey].totalHours += wh.totalHours
      summary[userId].monthlyHours[monthKey].shiftsCount += 1
      summary[userId].monthlyHours[monthKey].details.push({
        id: wh.id,
        shiftId: wh.shiftId,
        startTime: wh.startTime,
        endTime: wh.endTime,
        totalHours: wh.totalHours,
        submittedAt: wh.submittedAt,
        shift: wh.shift
      })
      
      summary[userId].yearlyTotal += wh.totalHours
    })

    // Convert to array format
    const result = Object.values(summary).map(userSummary => ({
      ...userSummary,
      monthlyHours: Object.entries(userSummary.monthlyHours).map(([month, data]) => ({
        month,
        ...data
      })).sort((a, b) => a.month.localeCompare(b.month))
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching hours summary:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
